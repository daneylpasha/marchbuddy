import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProgress, SessionRecord } from '../types/session';
import { getWeekStartDate } from '../utils/sessionUtils';
import { supabase } from '../api/supabase';

/**
 * Best-effort write of `profiles.comeback_completed_at` so the V2 Proactive
 * Coach Messages Edge Functions know to suppress proactive messages for the
 * 48-hour window after a comeback flow completes. Silent on failure — local
 * comeback handling still proceeds correctly.
 */
async function writeComebackCompletedAtRemote(): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const userId = data?.user?.id;
    if (!userId) return;
    await supabase
      .from('profiles')
      .update({ comeback_completed_at: new Date().toISOString() })
      .eq('id', userId);
  } catch (err) {
    console.warn('writeComebackCompletedAtRemote failed:', err);
  }
}

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
  setSessionHistory: (records: SessionRecord[]) => void;
  incrementLevel: () => void;
  resetWeeklyStats: () => void;
  resetProgress: () => void;
  setProgress: (progress: UserProgress) => void;
  setLevel: (level: number) => void;
  markComebackHandled: () => void;
  shouldShowComeback: () => boolean;
  declareRestDay: () => void;
  isPerfectWeek: (target?: number) => boolean;
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

      setSessionHistory: (records: SessionRecord[]) => {
        set({ sessionHistory: records.slice(-100) });
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
          } else if (diffDays === 2) {
            // 1-day grace period: life happens. Streak preserved but doesn't
            // grow — user must session today to keep building it.
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
        // V2 Proactive Coach Messages — write a server-side timestamp so the
        // schedule-coach-messages / send-coach-messages Edge Functions know
        // to suppress proactive messages for 48 hours after a comeback flow
        // completes (spec §7 edge case: "User in middle of comeback flow →
        // Pause all proactive messages for 48 hours after comeback
        // completion"). Best-effort: failure here doesn't break the comeback
        // flow itself — the user just gets one extra proactive message that
        // would otherwise have been suppressed.
        void writeComebackCompletedAtRemote();
      },

      shouldShowComeback: () => {
        const { progress, comebackHandledToday } = get();

        if (!progress || !progress.lastSessionDate) {
          return false;
        }

        // Once the user has handled the comeback (accepted a level
        // recommendation, chosen to chat, etc.), suppress the modal until
        // they actually complete a session AFTER that acceptance — only
        // then has the agreement materialised. Without this, the same
        // dormancy gap (lastSessionDate is still 7+ days old) would re-
        // trigger the screen every day until the user runs again.
        if (comebackHandledToday) {
          const handled = new Date(comebackHandledToday);
          const lastSession = new Date(progress.lastSessionDate);
          handled.setHours(0, 0, 0, 0);
          lastSession.setHours(0, 0, 0, 0);
          if (lastSession.getTime() <= handled.getTime()) {
            return false;
          }
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
      isPerfectWeek: (target = 3) => {
        const { progress, perfectWeekCelebrated } = get();
        if (!progress) return false;

        const currentWeekStart = getWeekStartDate();

        // Already celebrated this week?
        if (perfectWeekCelebrated === currentWeekStart) return false;

        return progress.sessionsThisWeek >= target;
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

// Auto-sync: push to Supabase whenever the fields that matter for cross-device
// restore change. Debounced so a session completion (updateAfterSession →
// incrementLevel firing in the same tick) only triggers one network call.
// pushRunProgress guards against guests and unauthenticated users internally.
let _syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;

useRunProgressStore.subscribe((state, prevState) => {
  const p = state.progress;
  const prev = prevState.progress;
  if (!p || !prev) return;

  const changed =
    p.currentLevel !== prev.currentLevel ||
    p.totalSessionsCompleted !== prev.totalSessionsCompleted ||
    p.currentStreakDays !== prev.currentStreakDays ||
    p.bestStreakDays !== prev.bestStreakDays ||
    p.lastSessionDate !== prev.lastSessionDate;

  if (!changed) return;

  if (_syncDebounceTimer) clearTimeout(_syncDebounceTimer);
  _syncDebounceTimer = setTimeout(() => {
    const { authService } = require('../services/authService');
    authService.pushRunProgress().catch(() => {});
  }, 2000);
});
