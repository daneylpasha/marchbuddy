import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../api/supabase';
import type { User } from '../types';
import { useProfileStore } from './profileStore';
import { offlineCache } from '../services/offlineCache';

interface AuthState {
  user: User | null;
  session: Session | null;
  isInitializing: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  isGuest: boolean;
  isRestoringSession: boolean;
  // Set when a guest user signs in to an already-registered account. We pause
  // the sign-in and surface a CHOICE to the user via the UI:
  //   • Use Existing Account → discard local guest data, restore server data
  //   • Keep Guest Session   → sign out of the new account, restore guest
  // We cache the fetched server data on the conflict object so the
  // "use existing account" path doesn't need a second round-trip.
  pendingSignInConflict: {
    session: Session;
    onboardingData: any;
    progressData: any | null;
  } | null;
  // Internal flag — see initial state comment.
  _conflictResolutionInProgress: boolean;

  setSession: (session: Session | null) => void;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  logout: () => void;
  initialize: () => Promise<void>;
  enterGuestMode: () => void;
  exitGuestMode: () => void;
  deleteAccount: () => Promise<void>;
  // Conflict-resolution actions (see pendingSignInConflict above).
  resolveConflictUseExistingAccount: () => void;
  resolveConflictKeepGuest: () => Promise<void>;
}

const mapSupabaseUser = (supabaseUser: { id: string; email?: string; created_at: string }): User => ({
  id: supabaseUser.id,
  email: supabaseUser.email ?? '',
  createdAt: supabaseUser.created_at,
});

// Detect guest data that should migrate to a real account. Uses guestId +
// setupComplete so the migration works even after `exitGuestMode` has been
// called (e.g. from the Settings "Create Account" flow, which exits guest
// mode before the user actually signs in).
export const hasLocalGuestDataToMigrate = (): boolean => {
  const { useCoachSetupStore } = require('./coachSetupStore');
  const setup = useCoachSetupStore.getState();
  return !!setup.guestId && !!setup.setupComplete;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isInitializing: true,
  isLoading: false,
  isAuthenticated: false,
  isGuest: false,
  isRestoringSession: false,
  pendingSignInConflict: null,
  // Internal: when we programmatically call supabase.auth.signOut() to roll
  // back a conflicting sign-in, the resulting SIGNED_OUT auth event would
  // otherwise fire the onAuthStateChange listener and clobber the guest
  // state we're restoring. Setting this flag makes setSession() a no-op
  // while a conflict rollback is in flight.
  _conflictResolutionInProgress: false,

  // ── Conflict resolution ─────────────────────────────────────────────────
  // User chose "Use Existing Account" — DISCARD local guest data, populate
  // local stores from the cached server data. Their guest progress is
  // intentionally abandoned so the existing account's data is authoritative.
  resolveConflictUseExistingAccount: () => {
    const pending = get().pendingSignInConflict;
    if (!pending) return;

    const { session, onboardingData, progressData } = pending;
    const { useCoachSetupStore } = require('./coachSetupStore');
    const { useSettingsStore } = require('./settingsStore');

    // Reset coachSetup so the SERVER WINS hydration below starts from a
    // clean slate (and clears guestId so we never re-trigger this conflict
    // for the same local data).
    useCoachSetupStore.getState().resetSetup();

    // onboardingData is null for legacy returning users (auth account
    // existed before user_onboarding table was created). In that case we
    // leave setupComplete=false so AppNavigator sends them through
    // CoachSetup once — the completion handler will sync to server and
    // they become a normal "has onboarding" user from then on.
    if (onboardingData?.onboarding_completed_at) {
      const current = useCoachSetupStore.getState();
      useCoachSetupStore.setState({
        setupComplete: true,
        guestId: null,
        setupData: {
          ...current.setupData,
          userName: onboardingData.user_name ?? current.setupData.userName,
          activityLevel: onboardingData.activity_level ?? current.setupData.activityLevel,
          timePreference: onboardingData.preferred_time ?? current.setupData.timePreference,
          triggerStatement:
            onboardingData.trigger_statement ?? current.setupData.triggerStatement,
          pastFailureReason:
            onboardingData.past_failure_reason ?? current.setupData.pastFailureReason,
          primaryFear: onboardingData.primary_fear ?? current.setupData.primaryFear,
          obstacles: onboardingData.practical_obstacles ?? current.setupData.obstacles,
          anchorPerson: onboardingData.anchor_person ?? current.setupData.anchorPerson,
          successVision: onboardingData.success_vision ?? current.setupData.successVision,
          preferredStartDate:
            onboardingData.start_preference ?? current.setupData.preferredStartDate,
          completedAt: onboardingData.onboarding_completed_at,
        },
      });
    } else {
      // Legacy returning user — no onboarding row on server. Clear guestId
      // but leave setupComplete=false so the user re-does onboarding once.
      useCoachSetupStore.setState({ setupComplete: false, guestId: null });
    }
    useSettingsStore.getState().setHasSeenIntro(true);

    const { useRunProgressStore } = require('./runProgressStore');
    if (progressData) {
      const { getWeekStartDate } = require('../utils/sessionUtils');
      useRunProgressStore.getState().setProgress({
        userId: session.user.id,
        currentLevel: progressData.current_level ?? 1,
        sessionsAtCurrentLevel: progressData.sessions_at_current_level ?? 0,
        totalSessionsCompleted: progressData.total_sessions_completed ?? 0,
        totalDistanceKm: progressData.total_distance_km ?? 0,
        totalDurationMinutes: progressData.total_duration_minutes ?? 0,
        longestRunMinutes: progressData.longest_run_minutes ?? 0,
        currentStreakDays: progressData.current_streak_days ?? 0,
        bestStreakDays: progressData.best_streak_days ?? 0,
        lastSessionDate: progressData.last_session_date ?? null,
        sessionsThisWeek: 0,
        minutesThisWeek: 0,
        weekStartDate: getWeekStartDate(),
      });
    } else {
      // No server progress yet — initialize defaults so TodayScreen can
      // load today's session.
      useRunProgressStore.getState().initializeProgress(session.user.id);
    }

    set({
      pendingSignInConflict: null,
      isRestoringSession: false,
      // Already authenticated from setSession's initial state set; nothing
      // else to do — AppNavigator will route to MainTabNavigator.
    });
  },

  // User chose "Keep Guest" — abort the sign-in by signing out of Supabase
  // and atomically restoring the local guest session.
  resolveConflictKeepGuest: async () => {
    set({ _conflictResolutionInProgress: true });
    try {
      await supabase.auth.signOut();
    } catch (signOutErr) {
      console.warn('Conflict rollback sign-out failed:', signOutErr);
    }
    set({
      session: null,
      user: { id: 'guest', email: '', createdAt: new Date().toISOString() },
      isGuest: true,
      isAuthenticated: true,
      isRestoringSession: false,
      pendingSignInConflict: null,
      _conflictResolutionInProgress: false,
    });
  },

  setSession: (session) => {
    // Suppress re-entrancy during conflict rollback. When we detect that a
    // guest user tried to sign in to an existing account, we call
    // supabase.auth.signOut() — that fires onAuthStateChange which would
    // otherwise recursively land here and wipe the restored guest state.
    if (get()._conflictResolutionInProgress) {
      return;
    }

    const hasUser = !!session?.user;
    // Snapshot whether local guest data exists BEFORE we mutate any state.
    // This determines whether we'll attempt to push guest data up (when the
    // server is empty for this user) or — if the server already has data for
    // this account — FLAG A CONFLICT and abort the sign-in, preserving the
    // user's current guest progress rather than silently discarding it.
    const hasGuestData = hasUser && hasLocalGuestDataToMigrate();

    set({
      session,
      user: session?.user ? mapSupabaseUser(session.user) : null,
      isAuthenticated: !!session,
      isGuest: false,
      // Always show the RestoringSessionView while we resolve server state.
      // This prevents any flash of the IntroNavigator or coach-setup screen
      // mid-sign-in.
      isRestoringSession: hasUser,
    });

    // Once a user is signed in, mark the intro as seen. Without this, a brand
    // new Google/email sign-in triggers the RestoringSessionView (which
    // unmounts the IntroNavigator mid-navigation), and when the restore
    // finishes AppNavigator re-renders with `hasSeenIntro === false` and
    // sends the user back to the Welcome screen — leaving them stuck in a
    // loop on app reopen. Setting it here guarantees the navigator routes to
    // OnboardingNavigator (new user) or MainTabNavigator (returning user)
    // once the session is established.
    if (hasUser) {
      const { useSettingsStore } = require('./settingsStore');
      if (!useSettingsStore.getState().hasSeenIntro) {
        useSettingsStore.getState().setHasSeenIntro(true);
      }
    }

    if (!hasUser) {
      return;
    }

    // ─── Unified user-state resolver ─────────────────────────────────────────
    // This is the single source of truth for deciding what happens after a
    // sign-in. Four possible outcomes:
    //   0. Guest data exists AND server already has data for this account →
    //      CONFLICT. Abort sign-in, restore guest session, surface an error.
    //      This prevents the user's in-progress guest data from being
    //      silently overwritten by server data — the user must consciously
    //      choose: use a different email OR abandon guest progress.
    //   1. Server has prior onboarding data (no guest conflict) → SERVER
    //      WINS. Populate local stores from server.
    //   2. Server is empty + local guest data exists → MIGRATE guest data up.
    //   3. Server is empty + no local guest data → brand new user, no-op.
    //      AppNavigator will route to OnboardingNavigator based on
    //      setupComplete=false.
    (async () => {
      try {
        await useProfileStore.getState().fetchProfile(session.user.id);

        const { useCoachSetupStore } = require('./coachSetupStore');
        const { useSettingsStore } = require('./settingsStore');

        const [onboardingRes, progressRes] = await Promise.all([
          supabase
            .from('user_onboarding')
            .select(
              'onboarding_completed_at, user_name, activity_level, preferred_time, trigger_statement, past_failure_reason, primary_fear, practical_obstacles, anchor_person, success_vision, start_preference',
            )
            .eq('user_id', session.user.id)
            .maybeSingle(),
          supabase
            .from('user_run_progress')
            .select(
              'current_level, sessions_at_current_level, total_sessions_completed, total_distance_km, total_duration_minutes, longest_run_minutes, current_streak_days, best_streak_days, last_session_date',
            )
            .eq('user_id', session.user.id)
            .maybeSingle(),
        ]);

        const onboardingData = onboardingRes.data;
        const progressData = progressRes.data;
        const serverHasOnboarding = !!onboardingData?.onboarding_completed_at;

        // Secondary signal for "returning user" — the auth.users row's age.
        // Supabase sets session.user.created_at when the auth user is first
        // minted. A brand new Google/email signup has created_at === now
        // (within a second or two); a returning user signing back in has
        // an OLD created_at (hours, days, months in the past).
        //
        // Why we need this: legacy accounts that registered BEFORE the
        // user_onboarding table existed have nothing in that table on the
        // server. serverHasOnboarding is false for them, so the "server
        // wins" / "conflict" branches don't fire — the resolver falls
        // through to MIGRATE and SILENTLY OVERWRITES whatever other data
        // that account had with the current guest's progress. Checking
        // created_at catches this class of returning user even when their
        // onboarding row is missing.
        const userCreatedAt = session.user.created_at;
        const authUserAgeMs = userCreatedAt
          ? Date.now() - new Date(userCreatedAt).getTime()
          : 0;
        const isReturningAuthUser = authUserAgeMs > 60_000; // > 1 minute old

        if (hasGuestData && (serverHasOnboarding || isReturningAuthUser)) {
          // ── Outcome 0: CONFLICT — pause and ask the user ───────────────
          // Either the signed-in account has onboarding data on the server
          // OR the auth.users row is old enough that this is clearly a
          // returning user. Both cases need the user's explicit choice
          // before we touch any data:
          //   • Use Existing Account → restore previous data (may be
          //     partial for legacy accounts), drop guest
          //   • Keep Guest           → cancel sign-in, stay in guest mode
          //
          // Don't decide for the user. Cache the fetched server data on
          // pendingSignInConflict; AppNavigator will surface a confirmation
          // alert and dispatch resolveConflictUseExistingAccount() or
          // resolveConflictKeepGuest() based on their choice.
          //
          // Keep isRestoringSession=true so AppNavigator continues to show
          // RestoringSessionView (and the Alert overlays it). This prevents
          // a flash of MainTabNavigator with mixed/incomplete state while
          // the user is making their decision.
          set({
            pendingSignInConflict: {
              session,
              onboardingData,
              progressData: progressData ?? null,
            },
          });
          return;
        }

        if (serverHasOnboarding) {
          // ── Outcome 1: SERVER WINS ─────────────────────────────────────
          // Overwrite local store with server data. Clear guestId so a
          // future sign-in doesn't trigger migration again.
          const current = useCoachSetupStore.getState();
          useCoachSetupStore.setState({
            setupComplete: true,
            guestId: null,
            setupData: {
              ...current.setupData,
              userName: onboardingData.user_name ?? current.setupData.userName,
              activityLevel: onboardingData.activity_level ?? current.setupData.activityLevel,
              timePreference: onboardingData.preferred_time ?? current.setupData.timePreference,
              triggerStatement:
                onboardingData.trigger_statement ?? current.setupData.triggerStatement,
              pastFailureReason:
                onboardingData.past_failure_reason ?? current.setupData.pastFailureReason,
              primaryFear: onboardingData.primary_fear ?? current.setupData.primaryFear,
              obstacles: onboardingData.practical_obstacles ?? current.setupData.obstacles,
              anchorPerson: onboardingData.anchor_person ?? current.setupData.anchorPerson,
              successVision: onboardingData.success_vision ?? current.setupData.successVision,
              preferredStartDate:
                onboardingData.start_preference ?? current.setupData.preferredStartDate,
              completedAt: onboardingData.onboarding_completed_at,
            },
          });
          useSettingsStore.getState().setHasSeenIntro(true);

          if (progressData) {
            const { useRunProgressStore } = require('./runProgressStore');
            const { getWeekStartDate } = require('../utils/sessionUtils');
            useRunProgressStore.getState().setProgress({
              userId: session.user.id,
              currentLevel: progressData.current_level ?? 1,
              sessionsAtCurrentLevel: progressData.sessions_at_current_level ?? 0,
              totalSessionsCompleted: progressData.total_sessions_completed ?? 0,
              totalDistanceKm: progressData.total_distance_km ?? 0,
              totalDurationMinutes: progressData.total_duration_minutes ?? 0,
              longestRunMinutes: progressData.longest_run_minutes ?? 0,
              currentStreakDays: progressData.current_streak_days ?? 0,
              bestStreakDays: progressData.best_streak_days ?? 0,
              lastSessionDate: progressData.last_session_date ?? null,
              sessionsThisWeek: 0,
              minutesThisWeek: 0,
              weekStartDate: getWeekStartDate(),
            });
            const { authService } = require('../services/authService');
            authService.pullSessionHistory(session.user.id).catch(() => {});
          }
        } else if (hasGuestData) {
          // ── Outcome 2: MIGRATE guest data to this brand-new account ───
          // Safe because we verified server has no onboarding_completed_at.
          const { authService } = require('../services/authService');
          await authService.syncLocalDataToSupabase(session.user.id);
          // Clear guestId so we don't re-migrate on subsequent auth events.
          useCoachSetupStore.setState({ guestId: null });
        }
        // ── Outcome 3: brand new user, no guest data — no-op.

        // Make sure runProgressStore is keyed to the real user id so
        // TodayScreen can pull the right session. Without this, a fresh
        // sign-in (where the server has no user_run_progress row yet, and
        // there's no local guestId either after our other fixes) leaves
        // runProgressStore.progress null, and TodayScreen falls through to
        // "Couldn't load today's session". Preserve any existing local
        // progress (matters for the MIGRATE branch — guest had run history
        // we want to keep on the new account); only swap the userId in.
        const { useRunProgressStore } = require('./runProgressStore');
        const currentProgress = useRunProgressStore.getState().progress;
        if (!currentProgress) {
          useRunProgressStore.getState().initializeProgress(session.user.id);
        } else if (currentProgress.userId !== session.user.id) {
          useRunProgressStore.setState({
            progress: { ...currentProgress, userId: session.user.id },
          });
        }
      } catch (err) {
        console.error('Error resolving user state:', err);
      } finally {
        // Don't drop isRestoringSession if we're paused on a conflict — the
        // UI must keep showing RestoringSessionView until the user picks
        // "Use Existing Account" or "Keep Guest". Those handlers will flip
        // isRestoringSession themselves once they finish.
        if (!get().pendingSignInConflict) {
          set({ isRestoringSession: false });
        }
      }
    })();
  },

  signUp: async (email, password) => {
    set({ isLoading: true });
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      set({ isLoading: false });
      throw error;
    }
    // We intentionally do NOT call setSession() here. Supabase emits a
    // SIGNED_IN event when signUp succeeds (auto-confirm) and our
    // onAuthStateChange listener picks it up and drives the unified
    // resolver. Calling setSession here too would run the resolver twice
    // concurrently and cause a race during conflict rollback.
    // If email confirmation is required, no session is emitted — the user
    // signs in later and the listener handles it then.
    set({ isLoading: false });
  },

  signIn: async (email, password) => {
    set({ isLoading: true });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      set({ isLoading: false });
      throw error;
    }
    // onAuthStateChange listener handles setSession + resolver. Calling
    // setSession directly here would run the resolver twice and race with
    // conflict rollback.
    set({ isLoading: false });
  },

  logout: () => {
    set({ user: null, session: null, isAuthenticated: false, isGuest: false });
  },

  enterGuestMode: () => {
    // Mark intro as seen the moment a user opts into guest mode — they've
    // consciously moved past the welcome/feature screens. Without this, a
    // first-time user tapping "Skip for now — explore as guest" on the
    // IntroNavigator's LoginScreen has isAuthenticated flip to true but
    // hasSeenIntro stays false, so AppNavigator keeps rendering
    // IntroNavigator (with LoginScreen still inside it) and the tap
    // appears to do nothing.
    const { useSettingsStore } = require('./settingsStore');
    if (!useSettingsStore.getState().hasSeenIntro) {
      useSettingsStore.getState().setHasSeenIntro(true);
    }

    set({
      isGuest: true,
      isAuthenticated: true,
      user: { id: 'guest', email: '', createdAt: new Date().toISOString() },
      session: null,
    });
  },

  exitGuestMode: () => {
    set({ isGuest: false, isAuthenticated: false, user: null, session: null });
  },

  signOut: async () => {
    set({ isLoading: true });

    // Clear push token from server before signing out
    const { clearPushToken } = require('../services/notificationService');
    await clearPushToken();

    const { error } = await supabase.auth.signOut();
    if (error) {
      set({ isLoading: false });
      throw error;
    }
    // Reset all stores so new user starts fresh
    const { useCoachSetupStore } = require('./coachSetupStore');
    const { useRunProgressStore } = require('./runProgressStore');
    const { useProgressStore } = require('./progressStore');
    const { useWorkoutStore } = require('./workoutStore');
    const { useNutritionStore } = require('./nutritionStore');
    const { useWaterStore } = require('./waterStore');
    const { useChatStore } = require('./chatStore');
    const { useScheduleStore } = require('./scheduleStore');

    useCoachSetupStore.getState().resetSetup();
    useRunProgressStore.getState().resetProgress();
    useProfileStore.setState({ profile: null, onboardingCompleted: false, isLoading: false });
    useProgressStore.getState().reset();
    useWorkoutStore.setState({ todayWorkout: null, workoutHistory: [], historyLoading: false, summary: null, isLoading: false });
    useNutritionStore.setState({ todayMealPlan: null, foodSnaps: [], isLoading: false });
    useWaterStore.setState({ todayWaterLog: null });
    useChatStore.setState({ messages: [], isAiTyping: false });
    useScheduleStore.setState({ scheduledSessions: [] });

    // Clear persisted cache so a re-login starts from fresh server data
    await offlineCache.clearAll();

    set({ user: null, session: null, isAuthenticated: false, isGuest: false, isLoading: false });
  },

  deleteAccount: async () => {
    set({ isLoading: true });
    try {
      const session = get().session;
      if (!session) throw new Error('No active session');

      // Clear push token before account deletion
      const { clearPushToken } = require('../services/notificationService');
      await clearPushToken();

      // Call Supabase Edge Function to delete user data and auth account
      const { error: fnError } = await supabase.functions.invoke('delete-account', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (fnError) throw fnError;

      // Reset all local stores
      const { useCoachSetupStore } = require('./coachSetupStore');
      const { useRunProgressStore } = require('./runProgressStore');
      const { useProgressStore } = require('./progressStore');
      const { useWorkoutStore } = require('./workoutStore');
      const { useNutritionStore } = require('./nutritionStore');
      const { useWaterStore } = require('./waterStore');
      const { useChatStore } = require('./chatStore');
      const { useScheduleStore } = require('./scheduleStore');

      useCoachSetupStore.getState().resetSetup();
      useRunProgressStore.getState().resetProgress();
      useProfileStore.setState({ profile: null, onboardingCompleted: false, isLoading: false });
      useProgressStore.getState().reset();
      useWorkoutStore.setState({ todayWorkout: null, workoutHistory: [], historyLoading: false, summary: null, isLoading: false });
      useNutritionStore.setState({ todayMealPlan: null, foodSnaps: [], isLoading: false });
      useWaterStore.setState({ todayWaterLog: null });
      useChatStore.setState({ messages: [], isAiTyping: false });
      useScheduleStore.setState({ scheduledSessions: [] });

      await offlineCache.clearAll();

      // Sign out locally
      await supabase.auth.signOut();
      set({ user: null, session: null, isAuthenticated: false, isGuest: false, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  initialize: async () => {
    set({ isInitializing: true });

    // Check for existing session (local — works offline)
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      // Try to refresh token, but don't block on network failure
      try {
        const { data: refreshed } = await supabase.auth.refreshSession();
        get().setSession(refreshed.session ?? session);
      } catch {
        // Offline or network error — use existing local session
        get().setSession(session);
      }
    } else {
      // No Supabase session — check if user was in guest mode
      const { useCoachSetupStore } = require('./coachSetupStore');
      const setupStore = useCoachSetupStore.getState();
      if (setupStore.setupComplete && setupStore.guestId) {
        get().enterGuestMode();
      }
    }

    // Listen for auth state changes
    supabase.auth.onAuthStateChange((_event, session) => {
      // Auth state changed — session updated silently
      get().setSession(session);
    });

    set({ isInitializing: false });
  },
}));
