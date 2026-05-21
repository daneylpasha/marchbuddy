// services/analytics.ts — PostHog wrapper with a typed event taxonomy
//
// Why a wrapper:
//   1. Keep PostHog as a swappable implementation detail (one day we may
//      add Mixpanel, Amplitude, etc. — call sites should not need to know).
//   2. Centralize the event taxonomy so we don't end up with three variants
//      of the same event firing (paywall_shown / paywallShown / paywall_view).
//   3. Make analytics calls safe to invoke before PostHog is initialized —
//      events are queued and replayed once init completes.
//
// Why imperative class instead of <PostHogProvider>:
//   Tracking calls happen from non-component code — Zustand stores, services,
//   async callbacks. An imperative singleton matches existing patterns
//   (authService, notificationService) and avoids re-render churn.

import PostHog from 'posthog-react-native';
import { POSTHOG_API_KEY, POSTHOG_HOST } from '../config/env';

// ─── Event taxonomy ──────────────────────────────────────────────────────
// Single source of truth for event names. Use the EVENTS constant at every
// call site instead of raw strings; TypeScript will catch typos at compile
// time and PostHog dashboards stay clean.
export const EVENTS = {
  // App lifecycle
  app_opened: 'app_opened',

  // Paywall lifecycle — these are the most important events for conversion
  paywall_shown: 'paywall_shown',
  paywall_dismissed: 'paywall_dismissed',
  paywall_plan_selected: 'paywall_plan_selected',
  paywall_cta_tapped: 'paywall_cta_tapped',
  paywall_restore_tapped: 'paywall_restore_tapped',

  // Purchase lifecycle (will be more meaningful once RevenueCat lands)
  purchase_started: 'purchase_started',
  purchase_completed: 'purchase_completed',
  purchase_failed: 'purchase_failed',
  purchase_cancelled: 'purchase_cancelled',
  subscription_restored: 'subscription_restored',

  // Free-tier funnel signals
  starting_level_captured: 'starting_level_captured',
  free_chat_limit_hit: 'free_chat_limit_hit',
  level_locked_view: 'level_locked_view',

  // Proactive Coach Messages (V2). `coach_message_scheduled` + `_sent` +
  // `_failed` fire server-side from the Edge Function; `_opened` and
  // `_replied` are client-side signals. Keep names in sync with the Edge
  // Function (supabase/functions/send-coach-messages/index.ts).
  coach_message_scheduled: 'coach_message_scheduled',
  coach_message_sent: 'coach_message_sent',
  coach_message_opened: 'coach_message_opened',
  coach_message_replied: 'coach_message_replied',
  coach_message_failed: 'coach_message_failed',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

// Identifies where a paywall view originated. Required prop on every
// paywall_shown event so we can attribute conversions to entry points and
// know which surfaces to optimize.
export type PaywallSource =
  | 'today_locked' // Level-locked takeover on TodayScreen
  | 'celebration_locked' // Hit the paywall after leveling up into Pro territory
  | 'chat_limit' // Free-tier daily chat limit hit
  | 'level_locked_next' // "Next level is Pro" anticipation banner
  | 'progress_general' // Generic upsell banner on ProgressScreen
  | 'feedback_locked' // Post-session feedback screen banner
  | 'onboarding' // End-of-onboarding paywall step (future)
  | 'settings_upgrade_row' // Settings → top "MarchBuddy Pro" row
  | 'header_chip_today' // "Free" chip in TodayScreen header
  | 'header_chip_progress' // "Free" chip in ProgressScreen header
  | 'manual'; // Unattributed / fallback

type Properties = Record<string, string | number | boolean | null | undefined>;

// Strip undefined keys so PostHog doesn't complain. We use `undefined` as a
// "skip this trait" sentinel in caller code; PostHog expects either a JSON
// value or no key at all.
const compact = (
  props?: Properties,
): Record<string, string | number | boolean | null> | undefined => {
  if (!props) return undefined;
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(props)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
};

class AnalyticsService {
  private posthog: PostHog | null = null;
  private isEnabled = false;
  // Buffered events that fire before init completes. Capped to prevent
  // memory bloat if init never resolves (e.g. no API key configured).
  private queue: { event: EventName; props?: Properties }[] = [];
  private readonly MAX_QUEUE = 50;

  /**
   * Initialize PostHog. Idempotent — safe to call multiple times.
   * If POSTHOG_API_KEY is empty (typical for dev), the service stays
   * silently disabled; all track/identify/reset calls become no-ops.
   */
  async init(): Promise<void> {
    if (this.posthog) return;
    if (!POSTHOG_API_KEY) {
      // Dev mode / unconfigured — drop the queue and stay silent.
      this.queue = [];
      return;
    }

    try {
      this.posthog = new PostHog(POSTHOG_API_KEY, {
        host: POSTHOG_HOST,
        // Flush after 20 events or 30 seconds, whichever comes first.
        flushAt: 20,
        flushInterval: 30000,
        // Don't pre-fetch feature flags on init — we don't use them yet,
        // and the /decide network call was the source of a "TypeError:
        // Network request failed" warning at boot when offline / on slow
        // networks. When we start using PostHog feature flags, flip this
        // back to true.
        preloadFeatureFlags: false,
        // Don't try to capture deep-link / app-state lifecycle events
        // automatically — we instrument what we care about explicitly via
        // analytics.track(). Reduces background network chatter and the
        // chance of surfacing transient fetch errors.
        captureAppLifecycleEvents: false,
        // Don't fail loudly on transient network errors during dev — log
        // them at debug level instead of throwing unhandled rejections
        // that LogBox catches and shows fullscreen.
        captureNativeAppLifecycleEvents: false,
      } as any);
      this.isEnabled = true;

      // Catch any unhandled rejections from PostHog's internal async chain
      // so they don't escape and trigger LogBox. PostHog will retry on its
      // own; failed sends queue locally and flush when network returns.
      const ph = this.posthog as unknown as {
        on?: (event: string, cb: (e: unknown) => void) => void;
      };
      if (typeof ph.on === 'function') {
        ph.on('error', (err) => console.warn('[analytics] posthog error:', err));
      }

      // Replay anything that was tracked before init completed
      for (const { event, props } of this.queue) {
        this.posthog.capture(event, compact(props));
      }
      this.queue = [];
    } catch (err) {
      // Analytics must never crash the app. Log and continue.
      console.warn('[analytics] init failed:', err);
    }
  }

  /**
   * Track an event. Always typed via EVENTS to prevent name drift.
   * Safe to call at any point in the app lifecycle.
   */
  track(event: EventName, properties?: Properties): void {
    if (!this.isEnabled) {
      if (this.queue.length < this.MAX_QUEUE) {
        this.queue.push({ event, props: properties });
      }
      return;
    }
    try {
      this.posthog?.capture(event, compact(properties));
    } catch (err) {
      console.warn('[analytics] track failed:', err);
    }
  }

  /**
   * Associate subsequent events with a stable user ID. Call on every
   * successful sign-in. PostHog stitches anonymous (pre-login) events to
   * the identified user behind the scenes.
   *
   * Note on PII: pass only IDs and aggregate traits here (tier, level,
   * starting_level). Do NOT pass email, name, or other personal data —
   * fitness data is sensitive and we don't need it in our analytics tool.
   */
  identify(userId: string, traits?: Properties): void {
    if (!this.isEnabled) return;
    try {
      this.posthog?.identify(userId, compact(traits));
    } catch (err) {
      console.warn('[analytics] identify failed:', err);
    }
  }

  /**
   * Clear the current user binding. Call on signOut / deleteAccount so the
   * next user on this device doesn't get attributed to the previous one.
   */
  reset(): void {
    if (!this.isEnabled) return;
    try {
      this.posthog?.reset();
    } catch (err) {
      console.warn('[analytics] reset failed:', err);
    }
  }

  /**
   * Pull the current authenticated user's traits from the various stores and
   * push them to PostHog as person properties. Call this after sign-in once
   * profile/subscription have hydrated, and after any meaningful state change
   * (upgrade to Pro, level up, etc.) so the Persons dashboard stays current.
   *
   * IMPORTANT — privacy boundary:
   *   We deliberately exclude sensitive health data (weight, height, age,
   *   injuries, dietary preferences, goals). PostHog is a third-party tool;
   *   sending health metrics there would create a GDPR / App Store privacy
   *   problem for negligible analytics value. The traits below are limited
   *   to identity, lifecycle, engagement, and subscription state — enough
   *   for cohorts and conversion analysis, nothing more.
   */
  refreshUserTraits(): void {
    if (!this.isEnabled) return;
    try {
      // Lazy require to avoid pulling stores into the analytics module
      // load order before zustand has hydrated.
      const { useAuthStore } = require('../store/authStore');
      const { useSubscriptionStore } = require('../store/subscriptionStore');
      const { useRunProgressStore } = require('../store/runProgressStore');
      const { useCoachSetupStore } = require('../store/coachSetupStore');
      const { Platform } = require('react-native');

      const auth = useAuthStore.getState();
      const sub = useSubscriptionStore.getState();
      const progress = useRunProgressStore.getState().progress;
      const setup = useCoachSetupStore.getState().setupData;

      if (!auth.user) return;

      const traits: Properties = {
        // Identity (lets you find a user in PostHog by email / name)
        email: auth.user.email ?? undefined,
        name: setup?.userName ?? undefined,

        // Lifecycle
        signup_date: auth.user.createdAt ?? undefined,
        platform: Platform.OS,

        // Subscription (most important for our funnel work)
        tier: sub.tier,
        starting_level: sub.startingLevel || undefined,
        free_until_level: sub.freeUntilLevel || undefined,
        expires_at: sub.expiresAt ?? undefined,

        // Engagement (lets us segment "active 7-day-streak users on free")
        current_level: progress?.currentLevel ?? undefined,
        total_sessions_completed: progress?.totalSessionsCompleted ?? undefined,
        current_streak_days: progress?.currentStreakDays ?? undefined,
        best_streak_days: progress?.bestStreakDays ?? undefined,
      };

      this.posthog?.identify(auth.user.id, compact(traits));
    } catch (err) {
      console.warn('[analytics] refreshUserTraits failed:', err);
    }
  }
}

export const analytics = new AnalyticsService();
