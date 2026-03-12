import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProgress, SessionRecord } from '../types/session';
import { getWeekStartDate } from '../utils/sessionUtils';

interface RunProgressState {
  progress: UserProgress | null;
  sessionHistory: SessionRecord[];
  isLoading: boolean;

  // Comeback tracking — ISO date string of when comeback was handled, or null
  comebackHandledToday: string | null;

  // Rest day tracking — ISO date string of declared rest day
  restDayDeclaredDate: string | null;

  // Perfect week tracking
  perfectWeekCelebrated: string | null; // weekStartDate of last celebrated perfect week

  // Actions
  initializeProgress: (userId: string) => void;
  updateAfterSession: (sessionData: {
    durationMinutes: number;
    distanceKm: number;
    longestRunMinutes?: number;
  }) => void;
  addToHistory: (record: SessionRecord) => void;
  incrementLevel: () => void;
  resetWeeklyStats: () => void;
  resetProgress: () => void;
  setProgress: (progress: UserProgress) => void;
  setLevel: (level: number) => void;
  markComebackHandled: () => void;
  shouldShowComeback: () => boolean;
  declareRestDay: () => void;
  isPerfectWeek: () => boolean;
  markPerfectWeekCelebrated: () => void;
}

const createInitialProgress = (userId: string): UserProgress => ({
  userId,
  currentLevel: 1,
  sessionsAtCurrentLevel: 0,
  totalSessionsCompleted: 0,
  totalDistanceKm: 0,
  totalDurationMinutes: 0,
  longestRunMinutes: 0,
  currentStreakDays: 0,
  bestStreakDays: 0,
  lastSessionDate: null,
  sessionsThisWeek: 0,
  minutesThisWeek: 0,
  weekStartDate: getWeekStartDate(),
});

export const useRunProgressStore = create<RunProgressState>()(
  persist(
    (set, get) => ({
      progress: null,
      sessionHistory: [],
      isLoading: true,
      comebackHandledToday: null,
      restDayDeclaredDate: null,
      perfectWeekCelebrated: null,

      addToHistory: (record: SessionRecord) => {
        set((state) => {
          const updated = [...state.sessionHistory, record];
          // Keep last 100 sessions only
          return { sessionHistory: updated.slice(-100) };
        });
      },

      initializeProgress: (userId: string) => {
        const existing = get().progress;
        if (existing && existing.userId === userId) {
          set({ isLoading: false });
          return;
        }
        set({
          progress: createInitialProgress(userId),
          isLoading: false,
        });
      },

      updateAfterSession: (sessionData) => {
        const current = get().progress;
        if (!current) return;

        const today = new Date().toISOString().split('T')[0];
        const currentWeekStart = getWeekStartDate();
        const needsWeekReset = current.weekStartDate !== currentWeekStart;

        // Calculate streak
        let newStreak = current.currentStreakDays;
        if (current.lastSessionDate) {
          const lastDate = new Date(current.lastSessionDate);
          const todayDate = new Date(today);
          const diffDays = Math.floor(
            (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
          );

          if (diffDays === 0) {
            // Same day — no change
          } else if (diffDays === 1) {
            newStreak += 1;
          } else {
            newStreak = 1;
          }
        } else {
          newStreak = 1;
        }

        set({
          progress: {
            ...current,
            totalSessionsCompleted: current.totalSessionsCompleted + 1,
            sessionsAtCurrentLevel: current.sessionsAtCurrentLevel + 1,
            totalDistanceKm: current.totalDistanceKm + sessionData.distanceKm,
            totalDurationMinutes: current.totalDurationMinutes + sessionData.durationMinutes,
            longestRunMinutes: Math.max(
              current.longestRunMinutes,
              sessionData.longestRunMinutes ?? 0,
            ),
            currentStreakDays: newStreak,
            bestStreakDays: Math.max(current.bestStreakDays, newStreak),
            lastSessionDate: today,
            sessionsThisWeek: needsWeekReset ? 1 : current.sessionsThisWeek + 1,
            minutesThisWeek: needsWeekReset
              ? sessionData.durationMinutes
              : current.minutesThisWeek + sessionData.durationMinutes,
            weekStartDate: currentWeekStart,
          },
        });
      },

      incrementLevel: () => {
        const current = get().progress;
        if (!current || current.currentLevel >= 16) return;

        set({
          progress: {
            ...current,
            currentLevel: current.currentLevel + 1,
            sessionsAtCurrentLevel: 0,
          },
        });
      },

      resetWeeklyStats: () => {
        const current = get().progress;
        if (!current) return;

        set({
          progress: {
            ...current,
            sessionsThisWeek: 0,
            minutesThisWeek: 0,
            weekStartDate: getWeekStartDate(),
          },
        });
      },

      resetProgress: () => {
        set({ progress: null, sessionHistory: [], isLoading: false });
      },

      setProgress: (progress) => {
        set({ progress, isLoading: false });
      },

      setLevel: (level: number) => {
        const { progress } = get();
        if (!progress) return;
        set({
          progress: {
            ...progress,
            currentLevel: Math.max(1, Math.min(16, level)),
            sessionsAtCurrentLevel: 0,
          },
        });
      },

      markComebackHandled: () => {
        const today = new Date().toISOString().split('T')[0];
        set({ comebackHandledToday: today });
      },

      shouldShowComeback: () => {
        const { progress, comebackHandledToday } = get();

        if (!progress || !progress.lastSessionDate) {
          return false;
        }

        const today = new Date().toISOString().split('T')[0];
        if (comebackHandledToday === today) {
          return false;
        }

        const lastSession = new Date(progress.lastSessionDate);
        const now = new Date();
        lastSession.setHours(0, 0, 0, 0);
        now.setHours(0, 0, 0, 0);

        const daysSince = Math.floor(
          (now.getTime() - lastSession.getTime()) / (1000 * 60 * 60 * 24),
        );

        return daysSince >= 7;
      },

      // ─── Rest day saves streak ──────────────────────────────────────
      declareRestDay: () => {
        const current = get().progress;
        if (!current) return;

        const today = new Date().toISOString().split('T')[0];

        // Rest day counts as "activity" for streak purposes —
        // update lastSessionDate so streak doesn't break tomorrow
        set({
          restDayDeclaredDate: today,
          progress: {
            ...current,
            lastSessionDate: today,
          },
        });
      },

      // ─── Perfect week detection ──────────────────────────────────────
      isPerfectWeek: () => {
        const { progress, perfectWeekCelebrated } = get();
        if (!progress) return false;

        const TARGET_SESSIONS = 3;
        const currentWeekStart = getWeekStartDate();

        // Already celebrated this week?
        if (perfectWeekCelebrated === currentWeekStart) return false;

        return progress.sessionsThisWeek >= TARGET_SESSIONS;
      },

      markPerfectWeekCelebrated: () => {
        const currentWeekStart = getWeekStartDate();
        set({ perfectWeekCelebrated: currentWeekStart });
      },
    }),
    {
      name: 'march-buddy-run-progress',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
