import { create } from 'zustand';
import type { FoodSnap, Meal, MealPlan } from '../types';
import { useAuthStore } from './authStore';
import { useNetworkStore } from './networkStore';
import {
  getTodayMealPlan,
  updateMealFeedback as dbUpdateMealFeedback,
  saveFoodSnap,
  getTodayFoodSnaps,
} from '../api/database';
import { MOCK_MODE } from '../mock';
import { offlineCache, CACHE_KEYS } from '../services/offlineCache';
import { offlineQueue } from '../services/offlineQueue';

interface ConsumedTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface NutritionState {
  todayMealPlan: MealPlan | null;
  foodSnaps: FoodSnap[];
  isLoading: boolean;

  fetchTodayMealPlan: (userId: string) => Promise<void>;
  updateMealFeedback: (
    mealId: string,
    feedback: Meal['feedback'],
    swapDescription?: string,
    swapNutrition?: { calories: number; protein: number; carbs: number; fat: number },
  ) => void;
  addFoodSnap: (snap: FoodSnap) => void;
  updateFoodSnap: (snapId: string, updates: Partial<FoodSnap>) => void;
  getConsumedTotals: () => ConsumedTotals;
}

export const useNutritionStore = create<NutritionState>((set, get) => ({
  todayMealPlan: null,
  foodSnaps: [],
  isLoading: false,

  fetchTodayMealPlan: async (userId) => {
    if (MOCK_MODE) return;
    set({ isLoading: true });
    try {
      const today = new Date().toISOString().split('T')[0];
      const isConnected = useNetworkStore.getState().isConnected;

      if (isConnected) {
        const [plan, snaps] = await Promise.all([
          getTodayMealPlan(userId, today),
          getTodayFoodSnaps(userId, today),
        ]);

        set({ todayMealPlan: plan ?? null });
        if (plan) offlineCache.set(CACHE_KEYS.TODAY_MEAL_PLAN, plan, userId);

        if (snaps.length > 0) {
          set({ foodSnaps: snaps });
          offlineCache.set(CACHE_KEYS.FOOD_SNAPS, snaps, userId);
        }
      } else {
        // Offline — load from cache
        const [cachedPlan, cachedSnaps] = await Promise.all([
          offlineCache.get<MealPlan>(CACHE_KEYS.TODAY_MEAL_PLAN, userId),
          offlineCache.get<FoodSnap[]>(CACHE_KEYS.FOOD_SNAPS, userId),
        ]);
        if (cachedPlan && cachedPlan.date === today) {
          set({ todayMealPlan: cachedPlan });
        }
        if (cachedSnaps && cachedSnaps.length > 0) {
          set({ foodSnaps: cachedSnaps });
        }
      }
    } catch (e) {
      console.error('[nutritionStore] fetchTodayMealPlan error:', e);
      // Fallback to cache
      const today = new Date().toISOString().split('T')[0];
      const cached = await offlineCache.get<MealPlan>(CACHE_KEYS.TODAY_MEAL_PLAN, userId);
      if (cached && cached.date === today) {
        set({ todayMealPlan: cached });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  updateMealFeedback: (mealId, feedback, swapDescription, swapNutrition) => {
    const plan = get().todayMealPlan;
    if (!plan) return;

    const meals = plan.meals.map((meal) =>
      meal.id === mealId
        ? {
            ...meal,
            feedback,
            ...(swapDescription !== undefined && { swapDescription }),
            ...(swapNutrition && {
              swapCalories: swapNutrition.calories,
              swapProtein: swapNutrition.protein,
              swapCarbs: swapNutrition.carbs,
              swapFat: swapNutrition.fat,
            }),
          }
        : meal,
    );
    const updated = { ...plan, meals };
    set({ todayMealPlan: updated });
    offlineCache.set(CACHE_KEYS.TODAY_MEAL_PLAN, updated, plan.userId);

    if (!MOCK_MODE) {
      const isConnected = useNetworkStore.getState().isConnected;
      if (isConnected) {
        dbUpdateMealFeedback(plan.id, meals).catch((e) =>
          console.error('[nutritionStore] updateMealFeedback persist error:', e),
        );
      } else {
        offlineQueue.enqueue('updateMealFeedback', [plan.id, meals]);
      }
    }
  },

  addFoodSnap: (snap) => {
    set((state) => {
      const snaps = [...state.foodSnaps, snap];
      const userId = useAuthStore.getState().user?.id;
      if (userId) offlineCache.set(CACHE_KEYS.FOOD_SNAPS, snaps, userId);
      return { foodSnaps: snaps };
    });

    const userId = useAuthStore.getState().user?.id;
    if (userId && !MOCK_MODE) {
      const isConnected = useNetworkStore.getState().isConnected;
      if (isConnected) {
        saveFoodSnap(userId, snap).catch((e) =>
          console.error('[nutritionStore] addFoodSnap persist error:', e),
        );
      } else {
        offlineQueue.enqueue('saveFoodSnap', [userId, snap]);
      }
    }
  },

  updateFoodSnap: (snapId, updates) => {
    set((state) => ({
      foodSnaps: state.foodSnaps.map((s) => (s.id === snapId ? { ...s, ...updates } : s)),
    }));
  },

  getConsumedTotals: () => {
    const plan = get().todayMealPlan;
    const snaps = get().foodSnaps;

    let calories = 0;
    let protein = 0;
    let carbs = 0;
    let fat = 0;

    if (plan) {
      for (const meal of plan.meals) {
        if (meal.feedback === 'ate-it') {
          calories += meal.calories;
          protein += meal.protein;
          carbs += meal.carbs;
          fat += meal.fat;
        } else if (meal.feedback === 'swapped') {
          calories += meal.swapCalories ?? meal.calories;
          protein += meal.swapProtein ?? meal.protein;
          carbs += meal.swapCarbs ?? meal.carbs;
          fat += meal.swapFat ?? meal.fat;
        }
      }
    }

    for (const snap of snaps) {
      const vals = snap.userAmended && snap.amendedValues ? snap.amendedValues : snap.aiEstimate;
      calories += vals.calories ?? 0;
      protein += vals.protein ?? 0;
      carbs += vals.carbs ?? 0;
      fat += vals.fat ?? 0;
    }

    return { calories, protein, carbs, fat };
  },
}));
