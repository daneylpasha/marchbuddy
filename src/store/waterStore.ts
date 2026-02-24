import { create } from 'zustand';
import type { WaterLog, WaterEntry } from '../types';
import { useAuthStore } from './authStore';
import { getTodayWaterLog, upsertWaterLog } from '../api/database';
import { MOCK_MODE } from '../mock';
import { APP_CONFIG } from '../config/appConfig';
import { generateUUID } from '../utils/uuid';

interface WaterState {
  todayWaterLog: WaterLog | null;

  fetchTodayWaterLog: (userId: string) => Promise<void>;
  logWater: (amount: number) => void;
  removeWaterEntry: (entryId: string) => void;
  updateGoal: (goal: number) => void;
}

function persistWaterLog(log: WaterLog) {
  if (MOCK_MODE) return;
  const userId = useAuthStore.getState().user?.id;
  if (userId) {
    upsertWaterLog(userId, log).catch((e) =>
      console.error('[waterStore] persist error:', e),
    );
  }
}

export const useWaterStore = create<WaterState>((set, get) => ({
  todayWaterLog: null,

  fetchTodayWaterLog: async (userId) => {
    if (MOCK_MODE) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const log = await getTodayWaterLog(userId, today);
      if (log) {
        set({ todayWaterLog: log });
      } else {
        // No log exists for today — create a default one
        const newLog: WaterLog = {
          id: generateUUID(),
          userId,
          date: today,
          goal: APP_CONFIG.DEFAULT_WATER_GOAL_ML,
          consumed: 0,
          entries: [],
        };
        set({ todayWaterLog: newLog });
        // Persist the new log
        upsertWaterLog(userId, newLog).catch((e) =>
          console.error('[waterStore] create initial log error:', e),
        );
      }
    } catch (e) {
      console.error('[waterStore] fetchTodayWaterLog error:', e);
      // Create default log on error
      const today = new Date().toISOString().split('T')[0];
      if (!get().todayWaterLog) {
        set({
          todayWaterLog: {
            id: generateUUID(),
            userId,
            date: today,
            goal: APP_CONFIG.DEFAULT_WATER_GOAL_ML,
            consumed: 0,
            entries: [],
          },
        });
      }
    }
  },

  logWater: (amount) => {
    const log = get().todayWaterLog;
    if (!log) return;

    const entry: WaterEntry = {
      id: generateUUID(),
      amount,
      loggedAt: new Date().toISOString(),
    };

    // Optimistic update
    const updated: WaterLog = {
      ...log,
      consumed: log.consumed + amount,
      entries: [...log.entries, entry],
    };
    set({ todayWaterLog: updated });

    // Persist in background
    persistWaterLog(updated);
  },

  removeWaterEntry: (entryId) => {
    const log = get().todayWaterLog;
    if (!log) return;
    const entry = log.entries.find((e) => e.id === entryId);
    if (!entry) return;

    // Optimistic update
    const updated: WaterLog = {
      ...log,
      consumed: Math.max(0, log.consumed - entry.amount),
      entries: log.entries.filter((e) => e.id !== entryId),
    };
    set({ todayWaterLog: updated });

    // Persist in background
    persistWaterLog(updated);
  },

  updateGoal: (goal) => {
    const log = get().todayWaterLog;
    if (!log) return;

    // Optimistic update
    const updated: WaterLog = { ...log, goal };
    set({ todayWaterLog: updated });

    // Persist in background
    persistWaterLog(updated);
  },
}));
