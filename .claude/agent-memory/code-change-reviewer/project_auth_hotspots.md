---
name: auth-flow-hotspots
description: High-risk areas and non-obvious invariants in the auth flow (authStore, App.tsx console filter, AppNavigator init) to scrutinize in reviews
metadata:
  type: project
---

High-risk review areas in the auth flow (verified 2026-06-12):

- `src/store/authStore.ts` `setSession()` is the single "unified user-state resolver" — it runs a fire-and-forget async IIFE with 4+ outcomes (conflict / server-wins / migrate / legacy). Any change to sign-in, sign-out, or token handling interacts with it. The `_conflictResolutionInProgress` flag makes `setSession` a no-op during guest-conflict rollback — easy to break.
- `initialize()` is called once from `AppNavigator.tsx` (~line 195) with `.finally(() => setIsAuthReady(true))` and NO `.catch()` — a throw inside `initialize()` skips `onAuthStateChange` registration and becomes an unhandled rejection. Flag any code that removes try/catch protection there.
- Supabase quirk that bit this repo: `supabase.auth.refreshSession()` returns errors via the `error` field, it does NOT throw — `try/catch` around it is dead code. Use `isAuthRetryableFetchError(error)` (exported from `@supabase/supabase-js` >= ~2.9x) to distinguish offline (keep session) from revoked token (sign out local).
- `signOut()` (user-initiated) resets ~10 stores; `setSession(null)` via auth events does NOT reset other stores — cross-account local-data leakage is a known soft spot if a different user signs in after a non-interactive sign-out.
- `App.tsx` has an intentional `console.error` monkey-patch with noise allowlists (PostHog, RevenueCat dev-only, Supabase "Invalid Refresh Token"). This is an accepted project pattern — don't flag the patch itself, but check new needles are narrow and justified by an actual handled path.
- Supabase client: `src/api/supabase.ts` — SecureStore adapter (all storage errors swallowed), `autoRefreshToken: true`, PKCE flow (implicit flow broke Google sign-in in 2025).

**How to apply:** Any diff touching these files gets the full auth checklist: logout loops, listener registration ordering, store-reset coverage, and offline-vs-revoked-token distinction.
