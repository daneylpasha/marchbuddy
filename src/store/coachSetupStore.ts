import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TriggerTheme, FailureTheme, FearTheme, AnchorTheme } from '../services/themeDetection';

export type { TriggerTheme, FailureTheme, FearTheme, AnchorTheme };

export type ObstacleId =
  | 'busy_work'
  | 'family_responsibilities'
  | 'weather'
  | 'motivation_dips'
  | 'physical_limitations'
  | 'inconsistent_routine'
  | 'tiredness'
  | 'other';

export type ActivityLevel =
  | 'no_exercise_years'
  | 'occasionally_walk'
  | 'somewhat_active'
  | 'active_want_run';

export type TimePreference = 'morning' | 'midday' | 'evening' | 'varies';

export type PastAttempts = 'multiple' | 'once_twice' | 'never';

interface SetupData {
  // Phase 1
  userName: string;
  activityLevel: ActivityLevel | null;
  timePreference: TimePreference | null;
  // Phase 2
  triggerStatement: string;
  triggerTheme: TriggerTheme | null;
  pastAttempts: PastAttempts | null;
  pastFailureReason: string;
  pastFailureTheme: FailureTheme | null;
  // Phase 3
  primaryFear: string;
  fearTheme: FearTheme | null;
  obstacles: ObstacleId[];
  obstaclesOther: string;
  // Phase 4
  anchorPerson: string;
  anchorTheme: AnchorTheme | null;
  successVision: string;
  // Phase 5
  preferredStartDate: 'today' | 'tomorrow' | null;
  // Timestamps
  startedAt: string | null;
  completedAt: string | null;
}

interface CoachSetupState {
  setupData: SetupData;
  setupComplete: boolean;
  guestId: string | null;  // Stable guest user ID (no auth required for MVP)
  // Phase 1 actions
  setUserName: (name: string) => void;
  setActivityLevel: (level: ActivityLevel) => void;
  setTimePreference: (pref: TimePreference) => void;
  // Phase 2 actions
  setTrigger: (statement: string, theme: TriggerTheme) => void;
  setPastAttempts: (attempts: PastAttempts) => void;
  setPastFailure: (reason: string, theme: FailureTheme) => void;
  // Phase 3 actions
  setFear: (statement: string, theme: FearTheme) => void;
  setObstacles: (ids: ObstacleId[], otherText: string) => void;
  // Phase 4 actions
  setAnchor: (statement: string, theme: AnchorTheme) => void;
  setVision: (statement: string) => void;
  setPreferredStartDate: (date: 'today' | 'tomorrow') => void;
  // Lifecycle
  markSetupStarted: () => void;
  markSetupComplete: () => void;
  resetSetup: () => void;
}

const emptySetupData = (): SetupData => ({
  userName: '',
  activityLevel: null,
  timePreference: null,
  triggerStatement: '',
  triggerTheme: null,
  pastAttempts: null,
  pastFailureReason: '',
  pastFailureTheme: null,
  primaryFear: '',
  fearTheme: null,
  obstacles: [],
  obstaclesOther: '',
  anchorPerson: '',
  anchorTheme: null,
  successVision: '',
  preferredStartDate: null,
  startedAt: null,
  completedAt: null,
});

export const useCoachSetupStore = create<CoachSetupState>()(
  persist(
    (set) => ({
  setupData: emptySetupData(),
  setupComplete: false,
  guestId: null,

  setUserName: (name) =>
    set((s) => ({ setupData: { ...s.setupData, userName: name } })),

  setActivityLevel: (level) =>
    set((s) => ({ setupData: { ...s.setupData, activityLevel: level } })),

  setTimePreference: (pref) =>
    set((s) => ({ setupData: { ...s.setupData, timePreference: pref } })),

  setTrigger: (statement, theme) =>
    set((s) => ({
      setupData: { ...s.setupData, triggerStatement: statement, triggerTheme: theme },
    })),

  setPastAttempts: (attempts) =>
    set((s) => ({ setupData: { ...s.setupData, pastAttempts: attempts } })),

  setPastFailure: (reason, theme) =>
    set((s) => ({
      setupData: { ...s.setupData, pastFailureReason: reason, pastFailureTheme: theme },
    })),

  setFear: (statement, theme) =>
    set((s) => ({
      setupData: { ...s.setupData, primaryFear: statement, fearTheme: theme },
    })),

  setObstacles: (ids, otherText) =>
    set((s) => ({
      setupData: { ...s.setupData, obstacles: ids, obstaclesOther: otherText },
    })),

  setAnchor: (statement, theme) =>
    set((s) => ({
      setupData: { ...s.setupData, anchorPerson: statement, anchorTheme: theme },
    })),

  setVision: (statement) =>
    set((s) => ({
      setupData: { ...s.setupData, successVision: statement },
    })),

  setPreferredStartDate: (date) =>
    set((s) => ({
      setupData: { ...s.setupData, preferredStartDate: date },
    })),

  markSetupStarted: () =>
    set((s) => ({
      setupData: { ...s.setupData, startedAt: new Date().toISOString() },
    })),

  markSetupComplete: () => {
    // Clear any stale auth session so user is forced through login/guest flow
    // after completing onboarding (prevents skipping LoginScreen when an old
    // Supabase session lingers in SecureStore from a previous install).
    const { useAuthStore } = require('./authStore');
    const authState = useAuthStore.getState();
    if (authState.isAuthenticated && !authState.isGuest) {
      authState.logout();
    }

    set((s) => ({
      setupComplete: true,
      // Generate a stable guest ID on first completion if one doesn't exist yet
      guestId: s.guestId ?? `guest-${Date.now()}`,
      setupData: { ...s.setupData, completedAt: new Date().toISOString() },
    }));
  },

  resetSetup: () => set({ setupData: emptySetupData(), setupComplete: false, guestId: null }),
    }),
    {
      name: 'march-buddy-coach-setup',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
