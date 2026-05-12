// config/env.ts — Environment configuration
//
// All values come from EXPO_PUBLIC_* environment variables. Set them via:
//   • Local development:  ./.env file (see .env.example for shape)
//   • CI:                 GitHub Secrets → written to .env in the workflow
//   • EAS builds:         EAS Secrets (eas secret:create --scope project ...)
//
// Why EXPO_PUBLIC_* prefix:
//   Expo only exposes env vars to client code when prefixed with EXPO_PUBLIC_.
//   Values are baked into the JS bundle at build time, so changing them
//   requires a new build (not just a JS reload).
//
// ─── Security boundary ──────────────────────────────────────────────────────
// Only Tier 1 (public, write-only, RLS-protected) keys belong here.
// Anything that can spend money, read sensitive data, or impersonate a user
// must live ONLY on the server (Supabase Edge Function secrets).
//
// Examples that belong here:
//   • Supabase URL + anon key (RLS protects data)
//   • PostHog project token (ingest-only)
//   • RevenueCat public Android/iOS keys (user-scoped)
//
// Examples that DO NOT belong here:
//   • Anthropic API key — Edge Function only, accessed via Deno.env.get()
//   • Supabase service role key — Edge Function only
//   • Stripe secret key — server only
//

const required = (name: string, value: string | undefined): string => {
  if (!value) {
    throw new Error(
      `Missing required env var: ${name}. ` +
        `Did you copy .env.example to .env and fill in the values?`,
    );
  }
  return value;
};

// ─── Supabase ──────────────────────────────────────────────────────────────
export const SUPABASE_URL = required(
  'EXPO_PUBLIC_SUPABASE_URL',
  process.env.EXPO_PUBLIC_SUPABASE_URL,
);
export const SUPABASE_ANON_KEY = required(
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
);

// ─── PostHog Analytics ─────────────────────────────────────────────────────
// Empty key disables analytics in this environment — useful for dev /
// preview builds where you don't want to pollute production data.
export const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? '';
export const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

// ─── RevenueCat ────────────────────────────────────────────────────────────
// Public Android API key from RevenueCat — designed to be in client code
// (it can only authenticate as the current user, not read other users' data).
// Empty key disables RC integration; the app will gracefully fall back to
// showing the paywall UI without being able to complete purchases.
//
// When iOS support is added, also wire EXPO_PUBLIC_REVENUECAT_IOS_KEY here
// and select platform-appropriate key at runtime via Platform.OS.
export const REVENUECAT_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '';
export const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
