// supabase/functions/revenuecat-webhook/index.ts
//
// RevenueCat → Supabase webhook handler.
//
// Why this exists:
//   RevenueCat is the authoritative source of truth for subscription state
//   because it talks directly to Google Play / Apple StoreKit and receives
//   signed receipts. Without this webhook, our server-side
//   `user_subscriptions.tier` field is written from the CLIENT — meaning
//   a tampered client could grant itself Pro without paying.
//
//   With this webhook in place, the tier flip is authoritative: only
//   RevenueCat (after verifying the receipt with the store) can fire an
//   INITIAL_PURCHASE / RENEWAL event that writes tier='pro'. The client
//   can still update non-entitlement fields (starting_level, etc.) but
//   the RLS policy on user_subscriptions forbids client writes to tier
//   directly.
//
// Configure in RevenueCat dashboard:
//   Project Settings → Integrations → Webhooks → Add new
//     • URL: https://yhfprdyivtedzwlzafnr.supabase.co/functions/v1/revenuecat-webhook
//     • Authorization header value: <random secret> — store same value in
//       Supabase secrets as REVENUECAT_WEBHOOK_SECRET
//     • Events: select all (we no-op on unknown events anyway)
//
// Deploy:
//   supabase functions deploy revenuecat-webhook --no-verify-jwt
//
//   --no-verify-jwt is REQUIRED because RC sends webhook calls without a
//   user JWT. We do our own authentication via the Authorization header
//   shared secret.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── Event types we handle ─────────────────────────────────────────────────
// Full list of RC event types: https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
// We map them to user_subscriptions.tier transitions.
//
// Events that flip tier to 'pro':
//   • INITIAL_PURCHASE   — first time the user subscribed
//   • RENEWAL            — subscription auto-renewed
//   • UNCANCELLATION     — user resumed a canceled-but-not-yet-expired sub
//   • PRODUCT_CHANGE     — user switched plans (monthly ↔ annual); still Pro
//   • TRANSFER           — entitlement transferred from another app user ID
//
// Events that flip tier to 'free':
//   • CANCELLATION       — DO NOT flip to free here. User canceled but
//                          still has paid time remaining. tier stays 'pro'
//                          until EXPIRATION fires. We just log it.
//   • EXPIRATION         — subscription period ended without renewal
//   • SUBSCRIPTION_PAUSED — Android-only; user paused subscription
//
// Events we log but don't act on:
//   • BILLING_ISSUE      — payment failed but user is in grace period;
//                          keep tier='pro' until EXPIRATION
//   • SUBSCRIBER_ALIAS   — RC internal user-merging
//   • TEST              — RC dashboard test webhook

type EventType =
  | 'INITIAL_PURCHASE'
  | 'RENEWAL'
  | 'UNCANCELLATION'
  | 'PRODUCT_CHANGE'
  | 'TRANSFER'
  | 'CANCELLATION'
  | 'EXPIRATION'
  | 'SUBSCRIPTION_PAUSED'
  | 'BILLING_ISSUE'
  | 'SUBSCRIBER_ALIAS'
  | 'TEST';

interface RCWebhookEvent {
  api_version: string;
  event: {
    type: EventType;
    id: string;
    event_timestamp_ms: number;
    app_user_id: string;        // matches our auth.users.id (set via Purchases.logIn)
    product_id: string;          // e.g. 'marchbuddy_pro_annual'
    period_type: 'NORMAL' | 'INTRO' | 'TRIAL' | 'PROMOTIONAL';
    purchased_at_ms: number;
    expiration_at_ms: number | null;
    environment: 'PRODUCTION' | 'SANDBOX';
    entitlement_ids: string[] | null;
    store: 'PLAY_STORE' | 'APP_STORE' | 'MAC_APP_STORE' | 'STRIPE' | 'PROMOTIONAL';
    transaction_id: string;
    original_transaction_id: string;
    is_family_share?: boolean;
    country_code?: string;
    aliases?: string[];
    original_app_user_id?: string;
  };
}

const PRO_ENTITLEMENT = 'pro';

// Events that grant pro
const PRO_GRANT_EVENTS: EventType[] = [
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'TRANSFER',
];

// Events that revoke pro
const PRO_REVOKE_EVENTS: EventType[] = ['EXPIRATION', 'SUBSCRIPTION_PAUSED'];

Deno.serve(async (req: Request) => {
  // ─── 1. Method check ─────────────────────────────────────────────────────
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // ─── 2. Shared-secret auth ───────────────────────────────────────────────
  // Reject any request that doesn't carry the configured Authorization
  // header. This prevents anyone from spoofing webhook events and granting
  // themselves Pro entitlement.
  const expectedSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  if (!expectedSecret) {
    console.error('REVENUECAT_WEBHOOK_SECRET not configured');
    return new Response('Server misconfigured', { status: 500 });
  }
  const receivedSecret = req.headers.get('Authorization');
  if (receivedSecret !== expectedSecret) {
    console.warn('webhook auth failed', { received: receivedSecret?.slice(0, 8) });
    return new Response('Unauthorized', { status: 401 });
  }

  // ─── 3. Parse body ───────────────────────────────────────────────────────
  let payload: RCWebhookEvent;
  try {
    payload = await req.json();
  } catch (err) {
    console.error('webhook body parse failed:', err);
    return new Response('Invalid JSON', { status: 400 });
  }

  const evt = payload.event;
  if (!evt) {
    return new Response('Missing event', { status: 400 });
  }

  console.log(`[rc-webhook] ${evt.type} for user ${evt.app_user_id}`, {
    product: evt.product_id,
    store: evt.store,
    environment: evt.environment,
    transaction: evt.transaction_id,
  });

  // ─── 4. No-op event types ────────────────────────────────────────────────
  // Acknowledge but don't touch the database. RC sees 200 and stops retrying.
  if (
    evt.type === 'CANCELLATION' ||
    evt.type === 'BILLING_ISSUE' ||
    evt.type === 'SUBSCRIBER_ALIAS' ||
    evt.type === 'TEST'
  ) {
    return new Response(JSON.stringify({ ok: true, action: 'noop' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ─── 5. Resolve target tier ──────────────────────────────────────────────
  let nextTier: 'pro' | 'free' | null = null;
  if (PRO_GRANT_EVENTS.includes(evt.type)) {
    // Sanity check — the event must include the pro entitlement to actually
    // grant pro. Without this check, a non-pro purchase could accidentally
    // grant pro if RC's entitlement mapping is misconfigured.
    if (!evt.entitlement_ids?.includes(PRO_ENTITLEMENT)) {
      console.log(`[rc-webhook] ${evt.type} did not include 'pro' entitlement — skipping`);
      return new Response(JSON.stringify({ ok: true, action: 'skip_no_pro_entitlement' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    nextTier = 'pro';
  } else if (PRO_REVOKE_EVENTS.includes(evt.type)) {
    nextTier = 'free';
  } else {
    console.log(`[rc-webhook] unknown event type ${evt.type} — no-op`);
    return new Response(JSON.stringify({ ok: true, action: 'unknown_event' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ─── 6. Write to user_subscriptions ──────────────────────────────────────
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, supabaseServiceKey);

  const platform =
    evt.store === 'APP_STORE' || evt.store === 'MAC_APP_STORE'
      ? 'ios'
      : evt.store === 'PLAY_STORE'
        ? 'android'
        : evt.store === 'PROMOTIONAL'
          ? 'promo'
          : evt.store === 'STRIPE'
            ? 'web'
            : null;

  const update = {
    user_id: evt.app_user_id,
    tier: nextTier,
    started_at: new Date(evt.purchased_at_ms).toISOString(),
    expires_at: evt.expiration_at_ms ? new Date(evt.expiration_at_ms).toISOString() : null,
    platform,
    revenuecat_user_id: evt.original_app_user_id ?? evt.app_user_id,
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin
    .from('user_subscriptions')
    .upsert(update, { onConflict: 'user_id' });

  if (error) {
    console.error('[rc-webhook] upsert failed:', error);
    // Return 500 so RC retries. The webhook is idempotent (upsert with
    // ON CONFLICT user_id) so retries are safe.
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  console.log(`[rc-webhook] applied tier=${nextTier} for user ${evt.app_user_id}`);
  return new Response(
    JSON.stringify({ ok: true, action: nextTier === 'pro' ? 'granted' : 'revoked' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});
