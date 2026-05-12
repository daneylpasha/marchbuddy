import { create } from 'zustand';
import type { WaterLog, WaterEntry } from '../types';
import { useAuthStore } from './authStore';
import { useNetworkStore } from './networkStore';
import { getTodayWaterLog, upsertWaterLog } from '../api/database';
import { MOCK_MODE } from '../mock';
import { APP_CONFIG } from '../config/appConfig';
import { generateUUID } from '../utils/uuid';
import { offlineCache, CACHE_KEYS } from '../services/offlineCache';
import { offlineQueue } from '../services/offlineQueue';

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
  if (!userId) return;

  // Always cache locally
  offlineCache.set(CACHE_KEYS.TODAY_WATER_LOG, log, userId);

  const isConnected = useNetworkStore.getState().isConnected;
  if (isConnected) {
    upsertWaterLog(userId, log).catch((e) => console.error('[waterStore] persist error:', e));
  } else {
    offlineQueue.enqueue('upsertWaterLog', [userId, log]);
  }
}

export const useWaterStore = create<WaterState>((set, get) => ({
  todayWaterLog: null,

  fetchTodayWaterLog: async (userId) => {
    if (MOCK_MODE) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const isConnected = useNetworkStore.getState().isConnected;

      if (isConnected) {
        const log = await getTodayWaterLog(userId, today);
        if (log) {
          set({ todayWaterLog: log });
          offlineCache.set(CACHE_KEYS.TODAY_WATER_LOG, log, userId);
        } else {
          const newLog: WaterLog = {
            id: generateUUID(),
            userId,
            date: today,
            goal: APP_CONFIG.DEFAULT_WATER_GOAL_ML,
            consumed: 0,
            entries: [],
          };
          set({ todayWaterLog: newLog });
          offlineCache.set(CACHE_KEYS.TODAY_WATER_LOG, newLog, userId);
          upsertWaterLog(userId, newLog).catch((e) =>
            console.error('[waterStore] create initial log error:', e),
          );
        }
      } else {
        // Offline — load from cache
        const cached = await offlineCache.get<WaterLog>(CACHE_KEYS.TODAY_WATER_LOG, userId);
        if (cached && cached.date === today) {
          set({ todayWaterLog: cached });
        } else {
          // Create local-only log for today
          const newLog: WaterLog = {
            id: generateUUID(),
            userId,
            date: today,
            goal: APP_CONFIG.DEFAULT_WATER_GOAL_ML,
            consumed: 0,
            entries: [],
          };
          set({ todayWaterLog: newLog });
          offlineCache.set(CACHE_KEYS.TODAY_WATER_LOG, newLog, userId);
        }
      }
    } catch (e) {
      console.error('[waterStore] fetchTodayWaterLog error:', e);
      const today = new Date().toISOString().split('T')[0];
      // Fallback to cache
      const cached = await offlineCache.get<WaterLog>(CACHE_KEYS.TODAY_WATER_LOG, userId);
      if (cached && cached.date === today) {
        set({ todayWaterLog: cached });
      } else if (!get().todayWaterLog) {
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

    const updated: WaterLog = {
      ...log,
      consumed: log.consumed + amount,
      entries: [...log.entries, entry],
    };
    set({ todayWaterLog: updated });
    persistWaterLog(updated);
  },

  removeWaterEntry: (entryId) => {
    const log = get().todayWaterLog;
    if (!log) return;
    const entry = log.entries.find((e) => e.id === entryId);
    if (!entry) return;

    const updated: WaterLog = {
      ...log,
      consumed: Math.max(0, log.consumed - entry.amount),
      entries: log.entries.filter((e) => e.id !== entryId),
    };
    set({ todayWaterLog: updated });
    persistWaterLog(updated);
  },

  updateGoal: (goal) => {
    const log = get().todayWaterLog;
    if (!log) return;

    const updated: WaterLog = { ...log, goal };
    set({ todayWaterLog: updated });
    persistWaterLog(updated);
  },
}));
