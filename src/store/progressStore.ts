import { create } from 'zustand';
import type { BodyMeasurement, WeeklySummary, WeightEntry } from '../types';
import { useAuthStore } from './authStore';
import { useNetworkStore } from './networkStore';
import {
  getWeightEntries,
  saveWeightEntry,
  getMeasurements,
  saveMeasurement,
  getWeeklySummaries,
  saveWeeklySummary,
} from '../api/database';
import { MOCK_MODE } from '../mock';
import { generateWeeklySummary } from '../services/aiService';
import { getWeekStart } from '../utils/dateUtils';
import { useProfileStore } from './profileStore';
import { useWorkoutStore } from './workoutStore';
import { useNutritionStore } from './nutritionStore';
import { useWaterStore } from './waterStore';
import { useChatStore } from './chatStore';
import { generateUUID } from '../utils/uuid';
import { offlineCache, CACHE_KEYS } from '../services/offlineCache';
import { offlineQueue } from '../services/offlineQueue';

interface ProgressState {
  weightEntries: WeightEntry[];
  measurements: BodyMeasurement[];
  weeklySummaries: WeeklySummary[];
  loaded: boolean;
  _loadedUserId: string | null;
  generatingSummary: boolean;

  loadProgressData: (userId: string) => Promise<void>;
  logWeight: (userId: string, weight: number) => void;
  logMeasurement: (measurement: BodyMeasurement) => void;
  fetchWeeklySummary: (userId: string) => Promise<void>;
  generateAndSaveWeeklySummary: (userId: string) => Promise<void>;
  reset: () => void;
}

export const useProgressStore = create<ProgressState>((set, get) => ({
  weightEntries: [],
  measurements: [],
  weeklySummaries: [],
  loaded: false,
  _loadedUserId: null,
  generatingSummary: false,

  reset: () => {
    set({
      weightEntries: [],
      measurements: [],
      weeklySummaries: [],
      loaded: false,
      _loadedUserId: null,
      generatingSummary: false,
    });
  },

  loadProgressData: async (userId) => {
    if (MOCK_MODE) return;
    if (get().loaded && get()._loadedUserId === userId) return;
    try {
      const isConnected = useNetworkStore.getState().isConnected;

      if (isConnected) {
        const [weights, measures, summaries] = await Promise.all([
          getWeightEntries(userId),
          getMeasurements(userId),
          getWeeklySummaries(userId),
        ]);

        set({
          weightEntries: weights,
          measurements: measures,
          weeklySummaries: summaries,
          loaded: true,
          _loadedUserId: userId,
        });

        // Cache all progress data
        offlineCache.set(CACHE_KEYS.WEIGHT_ENTRIES, weights, userId);
        offlineCache.set(CACHE_KEYS.MEASUREMENTS, measures, userId);
        offlineCache.set(CACHE_KEYS.WEEKLY_SUMMARIES, summaries, userId);
      } else {
        // Offline — load from cache
        const [weights, measures, summaries] = await Promise.all([
          offlineCache.get<WeightEntry[]>(CACHE_KEYS.WEIGHT_ENTRIES, userId),
          offlineCache.get<BodyMeasurement[]>(CACHE_KEYS.MEASUREMENTS, userId),
          offlineCache.get<WeeklySummary[]>(CACHE_KEYS.WEEKLY_SUMMARIES, userId),
        ]);

        set({
          weightEntries: weights ?? [],
          measurements: measures ?? [],
          weeklySummaries: summaries ?? [],
          loaded: true,
          _loadedUserId: userId,
        });
      }
    } catch (e) {
      console.error('[progressStore] loadProgressData error:', e);
      // Fallback to cache
      const [weights, measures, summaries] = await Promise.all([
        offlineCache.get<WeightEntry[]>(CACHE_KEYS.WEIGHT_ENTRIES, userId),
        offlineCache.get<BodyMeasurement[]>(CACHE_KEYS.MEASUREMENTS, userId),
        offlineCache.get<WeeklySummary[]>(CACHE_KEYS.WEEKLY_SUMMARIES, userId),
      ]);
      set({
        weightEntries: weights ?? [],
        measurements: measures ?? [],
        weeklySummaries: summaries ?? [],
        loaded: true,
        _loadedUserId: userId,
      });
    }
  },

  logWeight: (userId, weight) => {
    const date = new Date().toISOString().split('T')[0];
    const entry: WeightEntry = {
      id: generateUUID(),
      userId,
      weight,
      date,
    };

    // Optimistic update
    set((state) => {
      const entries = [...state.weightEntries, entry];
      offlineCache.set(CACHE_KEYS.WEIGHT_ENTRIES, entries, userId);
      return { weightEntries: entries };
    });

    if (!MOCK_MODE) {
      const isConnected = useNetworkStore.getState().isConnected;
      if (isConnected) {
        saveWeightEntry(userId, weight, date).catch((e) =>
          console.error('[progressStore] logWeight persist error:', e),
        );
      } else {
        offlineQueue.enqueue('saveWeightEntry', [userId, weight, date]);
      }
    }
  },

  logMeasurement: (measurement) => {
    // Optimistic update
    set((state) => {
      const measurements = [...state.measurements, measurement];
      const userId = useAuthStore.getState().user?.id;
      if (userId) offlineCache.set(CACHE_KEYS.MEASUREMENTS, measurements, userId);
      return { measurements };
    });

    const userId = useAuthStore.getState().user?.id;
    if (userId && !MOCK_MODE) {
      const isConnected = useNetworkStore.getState().isConnected;
      if (isConnected) {
        saveMeasurement(userId, measurement).catch((e) =>
          console.error('[progressStore] logMeasurement persist error:', e),
        );
      } else {
        offlineQueue.enqueue('saveMeasurement', [userId, measurement]);
      }
    }
  },

  fetchWeeklySummary: async (userId) => {
    if (MOCK_MODE) return;
    try {
      const isConnected = useNetworkStore.getState().isConnected;
      if (isConnected) {
        const summaries = await getWeeklySummaries(userId);
        if (summaries.length > 0) {
          set({ weeklySummaries: summaries });
          offlineCache.set(CACHE_KEYS.WEEKLY_SUMMARIES, summaries, userId);
        }
      }
      // If offline, cached data is already loaded from loadProgressData
    } catch (e) {
      console.error('[progressStore] fetchWeeklySummary error:', e);
    }
  },

  generateAndSaveWeeklySummary: async (userId) => {
    if (get().generatingSummary) return;

    // This requires AI — only works online
    const isConnected = useNetworkStore.getState().isConnected;
    if (!isConnected) return;

    const profile = useProfileStore.getState().profile;
    if (!profile) return;

    set({ generatingSummary: true });

    try {
      const todayWorkout = useWorkoutStore.getState().todayWorkout;
      const todayMealPlan = useNutritionStore.getState().todayMealPlan;
      const todayWaterLog = useWaterStore.getState().todayWaterLog;
      const chatMessages = useChatStore.getState().messages;
      const weightEntries = get().weightEntries;

      const weekData = {
        profile,
        weekWorkouts: todayWorkout ? [todayWorkout] : [],
        weekMealPlans: todayMealPlan ? [todayMealPlan] : [],
        weekWaterLogs: todayWaterLog ? [todayWaterLog] : [],
        weightEntries: weightEntries.map((w) => ({ weight: w.weight, date: w.date })),
        chatMessages: chatMessages.map((m) => ({ role: m.role, content: m.content })),
      };

      const result = await generateWeeklySummary(weekData);
      const weekStart = getWeekStart();

      const summary: WeeklySummary = {
        id: generateUUID(),
        userId,
        weekStartDate: weekStart,
        summaryText: result.summaryText,
        insights: result.insights,
        createdAt: new Date().toISOString(),
      };

      set((state) => {
        const summaries = [summary, ...state.weeklySummaries.filter((s) => s.weekStartDate !== weekStart)];
        offlineCache.set(CACHE_KEYS.WEEKLY_SUMMARIES, summaries, userId);
        return { weeklySummaries: summaries };
      });

      if (!MOCK_MODE) {
        saveWeeklySummary(userId, weekStart, result.summaryText, result.insights).catch((e) =>
          console.error('[progressStore] saveWeeklySummary persist error:', e),
        );
      }
    } catch (e) {
      console.error('[progressStore] generateAndSaveWeeklySummary error:', e);
    } finally {
      set({ generatingSummary: false });
    }
  },
}));
