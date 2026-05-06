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

// Self-reported continuous walk baseline. Used together with activityLevel
// and runReadiness to place new users at an appropriate starting level
// instead of forcing everyone through Level 1.
export type WalkBaseline =
  | 'under_5'
  | 'five_to_15'
  | 'fifteen_to_30'
  | 'thirty_plus';

// Only asked when walkBaseline >= 15 minutes — for low-baseline walkers,
// running readiness is moot since placement is bounded by walking capacity.
export type RunReadiness =
  | 'no_never_tried'
  | 'maybe_with_effort'
  | 'yes_easily';

export type TimePreference = 'morning' | 'midday' | 'evening' | 'varies';

export type PastAttempts = 'multiple' | 'once_twice' | 'never';

interface SetupData {
  // Phase 1
  userName: string;
  activityLevel: ActivityLevel | null;
  walkBaseline: WalkBaseline | null;
  runReadiness: RunReadiness | null;
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
  weeklyFrequency: number | null;
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
  setWalkBaseline: (baseline: WalkBaseline) => void;
  setRunReadiness: (readiness: RunReadiness | null) => void;
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
  setWeeklyFrequency: (freq: number) => void;
  // Lifecycle
  markSetupStarted: () => void;
  markSetupComplete: () => void;
  resetSetup: () => void;
}

const emptySetupData = (): SetupData => ({
  userName: '',
  activityLevel: null,
  walkBaseline: null,
  runReadiness: null,
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
  weeklyFrequency: null,
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

  setWalkBaseline: (baseline) =>
    set((s) => ({ setupData: { ...s.setupData, walkBaseline: baseline } })),

  setRunReadiness: (readiness) =>
    set((s) => ({ setupData: { ...s.setupData, runReadiness: readiness } })),

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

  setWeeklyFrequency: (freq) =>
    set((s) => ({
      setupData: { ...s.setupData, weeklyFrequency: freq },
    })),

  markSetupStarted: () =>
    set((s) => ({
      setupData: { ...s.setupData, startedAt: new Date().toISOString() },
    })),

  markSetupComplete: () => {
    // Mark intro as seen so welcome/feature screens never show again
    const { useSettingsStore } = require('./settingsStore');
    useSettingsStore.getState().setHasSeenIntro(true);

    // Only mint a guestId for actual guests (no Supabase session). For
    // authenticated users, guestId MUST stay null — otherwise a subsequent
    // sign-in misidentifies their local state as "guest with data to
    // migrate" and triggers the conflict-resolution dialog ("Use Existing
    // Account / Keep Guest") even though they're the real account owner.
    const { useAuthStore } = require('./authStore');
    const isAuthenticatedUser = !!useAuthStore.getState().session;

    set((s) => ({
      setupComplete: true,
      guestId: isAuthenticatedUser ? null : (s.guestId ?? `guest-${Date.now()}`),
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
