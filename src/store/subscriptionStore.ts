import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PaywallSource } from '../services/analytics';

type SubscriptionTier = 'free' | 'pro';

// ─── Free-tier limits ────────────────────────────────────────────────────
// Tunable per-tier limits. Pulled out as named constants so they're easy to
// adjust without hunting through gating logic, and A/B-test-ready when we
// hook them up to a remote config later.
//
// FREE_DAILY_CHAT_LIMIT — how many AI coach messages a free user can send
// per calendar day. 1 was too aggressive (industry benchmark for fitness
// AI apps is 3-5/day). 3 gives users a meaningful taste of the coach's
// value across a single session without giving away the core entitlement.
const FREE_DAILY_CHAT_LIMIT = 3;

interface ServerHydrationPayload {
  tier: SubscriptionTier;
  startingLevel: number;
  freeUntilLevel: number;
  expiresAt: string | null;
}

interface SubscriptionState {
  tier: SubscriptionTier;
  startingLevel: number; // 0 = not yet captured
  freeUntilLevel: number; // startingLevel + 1

  expiresAt: string | null; // ISO timestamp from server; null = no Pro subscription
  hydrated: boolean; // true once we've heard from the server at least once

  dailyChatCount: number;
  lastChatDate: string; // YYYY-MM-DD

  showPaywall: boolean;
  paywallSource: PaywallSource | null; // Where the current paywall view was triggered from

  // Mutations — each one persists locally AND pushes to server (fire-and-forget)
  setStartingLevel: (level: number) => void;
  upgrade: () => void;
  openPaywall: (source: PaywallSource) => void;
  closePaywall: () => void;
  canSendChat: () => boolean;
  incrementChatCount: () => void;
  isLevelLocked: (level: number) => boolean;
  isOnLastFreeLevel: (level: number) => boolean;

  // Server sync — called by authService
  hydrateFromServer: (payload: ServerHydrationPayload) => void;
  reset: () => void;
}

const todayStr = () => new Date().toISOString().split('T')[0];

// Lazy server-push: pulled via require to avoid an import cycle with authService.
// Failures are silent — local state is the read-fast cache, server is the durable
// source of truth that will reconcile on next pull.
const pushToServer = () => {
  try {
    const { authService } = require('../services/authService');
    authService.pushSubscription().catch(() => {});
  } catch {
    // authService not available (test env, etc.) — no-op
  }
};

// Sync the user's subscription/lifecycle traits to PostHog. Called after any
// store mutation that changes a trait PostHog should see (tier flip, free
// funnel capture, server hydration). Lazy require avoids analytics being a
// hard dependency of the store.
const refreshAnalyticsTraits = () => {
  try {
    const { analytics } = require('../services/analytics');
    analytics.refreshUserTraits();
  } catch {
    // analytics not available — non-fatal
  }
};

const FREE_DEFAULTS = {
  tier: 'free' as SubscriptionTier,
  startingLevel: 0,
  freeUntilLevel: 0,
  expiresAt: null,
  hydrated: false,
  dailyChatCount: 0,
  lastChatDate: '',
  showPaywall: false,
  paywallSource: null as PaywallSource | null,
};

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      ...FREE_DEFAULTS,

      // Idempotent — only sets once; captures user's initial level placement.
      // Pushes to server so the free-funnel boundary survives reinstall / new device.
      // Also fires the starting_level_captured analytics event exactly once
      // per user — useful for segmenting cohorts by where they entered.
      setStartingLevel: (level) => {
        if (get().startingLevel !== 0) return;
        set({ startingLevel: level, freeUntilLevel: level + 1 });
        pushToServer();
        try {
          const { analytics, EVENTS } = require('../services/analytics');
          analytics.track(EVENTS.starting_level_captured, {
            level,
            free_until_level: level + 1,
          });
        } catch {
          // analytics unavailable
        }
        refreshAnalyticsTraits();
      },

      // Flip local tier to 'pro'. This is optimistic — the RevenueCat
      // webhook (supabase/functions/revenuecat-webhook) is the authoritative
      // writer of the server-side tier. Pre-webhook propagation (usually
      // <5 seconds) the client sees Pro locally; once the webhook fires
      // and we pullSubscription, server agrees.
      //
      // Important: we deliberately do NOT push tier to the server here.
      // The RLS policy on user_subscriptions forbids it. Attempting to
      // do so would fail with a column-level permission error and
      // surface as a confusing console.error.
      //
      // Called by purchasesService.syncCustomerInfoToStore() after a
      // successful Purchases.purchasePackage().
      upgrade: () => {
        set({ tier: 'pro', showPaywall: false });
        // Note: pushToServer() is NOT called here. Tier is webhook-only.
        // We still push starting_level / free_until_level updates separately
        // via setStartingLevel() since those are client-owned fields.
        refreshAnalyticsTraits();
      },

      // Capture the source so analytics can attribute the view to the right
      // surface. Source is reset to null on close so a stale value never
      // bleeds into the next paywall view.
      openPaywall: (source) => set({ showPaywall: true, paywallSource: source }),
      closePaywall: () => set({ showPaywall: false, paywallSource: null }),

      canSendChat: () => {
        const { tier, dailyChatCount, lastChatDate } = get();
        if (tier === 'pro') return true;
        if (lastChatDate !== todayStr()) return true; // new day resets count
        return dailyChatCount < FREE_DAILY_CHAT_LIMIT;
      },

      incrementChatCount: () => {
        const today = todayStr();
        const { lastChatDate, dailyChatCount } = get();
        if (lastChatDate !== today) {
          set({ dailyChatCount: 1, lastChatDate: today });
        } else {
          set({ dailyChatCount: dailyChatCount + 1 });
        }
      },

      isLevelLocked: (level) => {
        const { tier, freeUntilLevel } = get();
        if (tier === 'pro') return false;
        if (freeUntilLevel === 0) return false;
        return level > freeUntilLevel;
      },

      isOnLastFreeLevel: (level) => {
        const { tier, freeUntilLevel } = get();
        if (tier === 'pro') return false;
        if (freeUntilLevel === 0) return false;
        return level === freeUntilLevel;
      },

      // ─── Server sync ──────────────────────────────────────────────────
      //
      // Server is the source of truth. When pulled on login, we OVERWRITE
      // local state (not merge) — except for chat-count fields, which are
      // device-local until we move them server-side (TODO).
      //
      // The free-funnel fields (startingLevel, freeUntilLevel) are tricky:
      // if the local store has captured them but the server hasn't yet
      // (legacy account, first-time login on a new device with stale local
      // data), the server's 0 / 0 would wipe them. Resolution: if server
      // is 0 / 0 and local has captured values, push local up. Otherwise
      // trust the server.
      hydrateFromServer: ({ tier, startingLevel, freeUntilLevel, expiresAt }) => {
        const local = get();
        const serverHasFunnel = startingLevel !== 0;
        const localHasFunnel = local.startingLevel !== 0;

        if (!serverHasFunnel && localHasFunnel) {
          // Server is missing funnel state — push ours up
          set({
            tier,
            expiresAt,
            hydrated: true,
            // Keep local funnel values
          });
          pushToServer();
        } else {
          // Trust the server (including the case where both are unset)
          set({
            tier,
            startingLevel,
            freeUntilLevel,
            expiresAt,
            hydrated: true,
          });
        }
        // Hydrated traits should be reflected in PostHog Persons immediately.
        // Useful on a new-device sign-in: tier, starting_level, and
        // expires_at all become accurate without needing the user to take
        // any action.
        refreshAnalyticsTraits();
      },

      // Clear all subscription state. Call on signOut / deleteAccount so
      // a subsequent sign-in on the same device doesn't inherit the
      // previous user's Pro tier or free-funnel placement.
      reset: () => {
        set({ ...FREE_DEFAULTS });
      },
    }),
    {
      name: 'subscription-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        tier: state.tier,
        startingLevel: state.startingLevel,
        freeUntilLevel: state.freeUntilLevel,
        expiresAt: state.expiresAt,
        dailyChatCount: state.dailyChatCount,
        lastChatDate: state.lastChatDate,
      }),
    },
  ),
);
