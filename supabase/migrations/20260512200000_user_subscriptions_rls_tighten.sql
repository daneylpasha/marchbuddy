-- ============================================================================
-- user_subscriptions: tighten RLS so that ONLY the RevenueCat webhook
-- (running as service_role) can write entitlement fields (tier, started_at,
-- expires_at, platform, revenuecat_user_id). The authenticated client can
-- still update its own free-funnel fields (starting_level, free_until_level)
-- — those are not security-sensitive.
--
-- Why this matters:
--   Without this, a tampered client could call supabase.from('user_subs')
--   .update({ tier: 'pro' }) and grant itself Pro entitlement without
--   actually paying. The earlier migration allowed clients to write all
--   fields because we didn't have the webhook yet. Now that the webhook
--   (supabase/functions/revenuecat-webhook) is the authoritative writer
--   of tier, we lock the client out of those columns.
--
-- Strategy: drop the broad "Users can update own subscription" policy and
-- replace it with one that restricts WHICH ROWS the user can update plus
-- column-level GRANTs that restrict WHICH FIELDS.
--
-- Service role bypasses RLS entirely (per Supabase default), so the
-- webhook has full write access without needing a separate policy.
-- ============================================================================

-- Drop the broad update policy from the original migration
drop policy if exists "Users can update own subscription" on public.user_subscriptions;

-- Replace with a row-scoped update policy. The column restriction is
-- handled separately via REVOKE/GRANT below — Postgres doesn't allow
-- column-level expressions inside RLS policy USING/WITH CHECK clauses.
create policy "Users can update own funnel state"
  on public.user_subscriptions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── Column-level grants ───────────────────────────────────────────────────
-- Revoke blanket UPDATE from authenticated, then grant UPDATE only on
-- the two free-funnel columns. The webhook (service_role) bypasses these
-- grants because service_role has BYPASSRLS and superuser-equivalent privs.
--
-- A tampered client trying to UPDATE tier will now get:
--   ERROR: permission denied for column tier of relation user_subscriptions
revoke update on public.user_subscriptions from authenticated;
grant update (starting_level, free_until_level, updated_at)
  on public.user_subscriptions
  to authenticated;

-- ─── Verify INSERT path is also tight ──────────────────────────────────────
-- The trigger handle_new_user_subscription() runs as definer (service_role)
-- so it can insert rows with default tier='free'. Clients can also insert
-- via the existing "Users can insert own subscription" policy, but the
-- check constraint on tier limits values to ('free', 'pro') anyway, and
-- the on_conflict (user_id) in the webhook means a malicious INSERT of
-- tier='pro' would be overwritten by the next legitimate webhook event.
--
-- For defense in depth, we could also revoke INSERT(tier) from authenticated,
-- but the trigger creates the row at signup with default tier='free', so
-- the client never needs to INSERT at all. Revoking is safe:
revoke insert on public.user_subscriptions from authenticated;
grant insert (user_id, starting_level, free_until_level)
  on public.user_subscriptions
  to authenticated;

-- ─── Sanity comment for future migrations ──────────────────────────────────
comment on column public.user_subscriptions.tier is
  'Entitlement tier. ONLY writable by service_role (via RevenueCat webhook). '
  'Authenticated clients cannot write this column — attempts will fail with '
  'a column-level permission error.';

comment on column public.user_subscriptions.expires_at is
  'Subscription expiration timestamp. ONLY writable by service_role. '
  'See revenuecat-webhook edge function.';

comment on column public.user_subscriptions.starting_level is
  'Free-funnel boundary captured on first session — defines where the user '
  'started their journey. Writable by authenticated client (their own row only).';
