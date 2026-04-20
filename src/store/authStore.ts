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

  setSession: (session: Session | null) => void;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  logout: () => void;
  initialize: () => Promise<void>;
  enterGuestMode: () => void;
  exitGuestMode: () => void;
  deleteAccount: () => Promise<void>;
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

  setSession: (session) => {
    set({
      session,
      user: session?.user ? mapSupabaseUser(session.user) : null,
      isAuthenticated: !!session,
      isGuest: false,
    });

    // Auto-load profile and restore setup state when session is set
    if (session?.user) {
      useProfileStore.getState().fetchProfile(session.user.id);

      // Restore setupComplete from server for returning users
      const { useCoachSetupStore } = require('./coachSetupStore');
      const { useSettingsStore } = require('./settingsStore');
      const setupStore = useCoachSetupStore.getState();
      if (!setupStore.setupComplete) {
        (async () => {
          try {
            const { data } = await supabase
              .from('user_onboarding')
              .select('onboarding_completed_at, user_name, activity_level, preferred_time')
              .eq('user_id', session.user.id)
              .maybeSingle();
            if (data?.onboarding_completed_at) {
              useCoachSetupStore.setState({
                setupComplete: true,
                setupData: {
                  ...useCoachSetupStore.getState().setupData,
                  userName: data.user_name || '',
                  activityLevel: data.activity_level || null,
                  timePreference: data.preferred_time || null,
                  completedAt: data.onboarding_completed_at,
                },
              });
              useSettingsStore.getState().setHasSeenIntro(true);
            }
          } catch (err) {
            console.error('Error restoring setup:', err);
          }
        })();
      }
    }
  },

  signUp: async (email, password) => {
    set({ isLoading: true });
    const hasGuestData = hasLocalGuestDataToMigrate();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      set({ isLoading: false });
      throw error;
    }
    // Session may be null if email confirmation is required
    if (data.session) {
      get().setSession(data.session);
      if (hasGuestData) {
        const { authService } = require('../services/authService');
        authService.syncLocalDataToSupabase(data.session.user.id).catch(console.error);
      }
    }
    set({ isLoading: false });
  },

  signIn: async (email, password) => {
    set({ isLoading: true });
    const hasGuestData = hasLocalGuestDataToMigrate();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      set({ isLoading: false });
      throw error;
    }
    get().setSession(data.session);
    if (hasGuestData) {
      const { authService } = require('../services/authService');
      authService.syncLocalDataToSupabase(data.session.user.id).catch(console.error);
    }
    set({ isLoading: false });
  },

  logout: () => {
    set({ user: null, session: null, isAuthenticated: false, isGuest: false });
  },

  enterGuestMode: () => {
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
