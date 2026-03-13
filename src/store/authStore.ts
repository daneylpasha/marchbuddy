import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../api/supabase';
import type { User } from '../types';
import { useProfileStore } from './profileStore';

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
    });

    // Auto-load profile when session is set
    if (session?.user) {
      useProfileStore.getState().fetchProfile(session.user.id);
    }
  },

  signUp: async (email, password) => {
    set({ isLoading: true });
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      set({ isLoading: false });
      throw error;
    }
    // Session may be null if email confirmation is required
    if (data.session) {
      get().setSession(data.session);
    }
    set({ isLoading: false });
  },

  signIn: async (email, password) => {
    set({ isLoading: true });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      set({ isLoading: false });
      throw error;
    }
    get().setSession(data.session);
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

    useCoachSetupStore.getState().resetSetup();
    useRunProgressStore.getState().resetProgress();
    useProfileStore.setState({ profile: null, onboardingCompleted: false, isLoading: false });
    useProgressStore.getState().reset();
    useWorkoutStore.setState({ todayWorkout: null, workoutHistory: [], historyLoading: false, summary: null, isLoading: false });
    useNutritionStore.setState({ todayMealPlan: null, foodSnaps: [], isLoading: false });
    useWaterStore.setState({ todayWaterLog: null });
    useChatStore.setState({ messages: [], isAiTyping: false });

    set({ user: null, session: null, isAuthenticated: false, isGuest: false, isLoading: false });
  },

  deleteAccount: async () => {
    set({ isLoading: true });
    try {
      const session = get().session;
      if (!session) throw new Error('No active session');

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

      useCoachSetupStore.getState().resetSetup();
      useRunProgressStore.getState().resetProgress();
      useProfileStore.setState({ profile: null, onboardingCompleted: false, isLoading: false });
      useProgressStore.getState().reset();
      useWorkoutStore.setState({ todayWorkout: null, workoutHistory: [], historyLoading: false, summary: null, isLoading: false });
      useNutritionStore.setState({ todayMealPlan: null, foodSnaps: [], isLoading: false });
      useWaterStore.setState({ todayWaterLog: null });
      useChatStore.setState({ messages: [], isAiTyping: false });

      // Sign out locally
      await supabase.auth.signOut();
      set({ user: null, session: null, isAuthenticated: false, isGuest: false, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  initialize: async () => {
    console.log('🔐 Checking existing session...');
    set({ isInitializing: true });

    // Check for existing session
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      console.log('🔐 Session found for user:', session.user.id);
      // Proactively refresh the token to ensure it's valid
      const { data: refreshed } = await supabase.auth.refreshSession();
      if (refreshed.session) {
        console.log('🔐 Session refreshed successfully');
        get().setSession(refreshed.session);
      } else {
        console.log('🔐 Refresh failed, using existing session');
        get().setSession(session);
      }
    } else {
      console.log('🔐 No existing session found');
    }

    // Listen for auth state changes
    supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔄 Auth state changed:', event, session?.user?.id ?? 'no user');
      get().setSession(session);
    });

    set({ isInitializing: false });
  },
}));
