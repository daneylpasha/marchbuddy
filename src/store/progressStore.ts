import { create } from 'zustand';
import type { BodyMeasurement, WeeklySummary, WeightEntry } from '../types';
import { useAuthStore } from './authStore';
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
    // Re-fetch if user changed
    if (get().loaded && get()._loadedUserId === userId) return;
    try {
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
    } catch (e) {
      console.error('[progressStore] loadProgressData error:', e);
      set({ loaded: true, _loadedUserId: userId });
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
    set((state) => ({ weightEntries: [...state.weightEntries, entry] }));

    // Persist in background
    if (!MOCK_MODE) {
      saveWeightEntry(userId, weight, date).catch((e) =>
        console.error('[progressStore] logWeight persist error:', e),
      );
    }
  },

  logMeasurement: (measurement) => {
    // Optimistic update
    set((state) => ({ measurements: [...state.measurements, measurement] }));

    // Persist in background
    const userId = useAuthStore.getState().user?.id;
    if (userId && !MOCK_MODE) {
      saveMeasurement(userId, measurement).catch((e) =>
        console.error('[progressStore] logMeasurement persist error:', e),
      );
    }
  },

  fetchWeeklySummary: async (userId) => {
    if (MOCK_MODE) return;
    try {
      const summaries = await getWeeklySummaries(userId);
      if (summaries.length > 0) {
        set({ weeklySummaries: summaries });
      }
    } catch (e) {
      console.error('[progressStore] fetchWeeklySummary error:', e);
    }
  },

  generateAndSaveWeeklySummary: async (userId) => {
    if (get().generatingSummary) return;
    set({ generatingSummary: true });

    try {
      const profile = useProfileStore.getState().profile;
      if (!profile) throw new Error('No profile');

      // Gather week data from stores
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

      // Optimistic update
      set((state) => ({
        weeklySummaries: [summary, ...state.weeklySummaries.filter((s) => s.weekStartDate !== weekStart)],
      }));

      // Persist in background
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
