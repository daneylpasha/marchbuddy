import { create } from 'zustand';
import type { FoodSnap, Meal, MealPlan } from '../types';
import { useAuthStore } from './authStore';
import {
  getTodayMealPlan,
  upsertMealPlan,
  updateMealFeedback as dbUpdateMealFeedback,
  saveFoodSnap,
  getTodayFoodSnaps,
} from '../api/database';
import { MOCK_MODE } from '../mock';

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
  updateMealFeedback: (mealId: string, feedback: Meal['feedback'], swapDescription?: string, swapNutrition?: { calories: number; protein: number; carbs: number; fat: number }) => void;
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

      // Fetch meal plan and food snaps in parallel
      const [plan, snaps] = await Promise.all([
        getTodayMealPlan(userId, today),
        getTodayFoodSnaps(userId, today),
      ]);

      set({ todayMealPlan: plan ?? null });

      if (snaps.length > 0) {
        set({ foodSnaps: snaps });
      }
    } catch (e) {
      console.error('[nutritionStore] fetchTodayMealPlan error:', e);
    } finally {
      set({ isLoading: false });
    }
  },

  updateMealFeedback: (mealId, feedback, swapDescription, swapNutrition) => {
    const plan = get().todayMealPlan;
    if (!plan) return;

    // Optimistic update
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

    // Persist in background
    if (!MOCK_MODE) {
      dbUpdateMealFeedback(plan.id, meals).catch((e) =>
        console.error('[nutritionStore] updateMealFeedback persist error:', e),
      );
    }
  },

  addFoodSnap: (snap) => {
    // Optimistic update
    set((state) => ({ foodSnaps: [...state.foodSnaps, snap] }));

    // Persist in background
    const userId = useAuthStore.getState().user?.id;
    if (userId && !MOCK_MODE) {
      saveFoodSnap(userId, snap).catch((e) =>
        console.error('[nutritionStore] addFoodSnap persist error:', e),
      );
    }
  },

  updateFoodSnap: (snapId, updates) => {
    // Optimistic update only — no dedicated DB call for partial snap updates yet
    set((state) => ({
      foodSnaps: state.foodSnaps.map((s) =>
        s.id === snapId ? { ...s, ...updates } : s,
      ),
    }));
  },

  getConsumedTotals: () => {
    const plan = get().todayMealPlan;
    const snaps = get().foodSnaps;

    let calories = 0;
    let protein = 0;
    let carbs = 0;
    let fat = 0;

    // Count meals marked as ate-it or swapped
    if (plan) {
      for (const meal of plan.meals) {
        if (meal.feedback === 'ate-it') {
          calories += meal.calories;
          protein += meal.protein;
          carbs += meal.carbs;
          fat += meal.fat;
        } else if (meal.feedback === 'swapped') {
          // Use AI-estimated swap nutrition if available, otherwise fall back to original
          calories += meal.swapCalories ?? meal.calories;
          protein += meal.swapProtein ?? meal.protein;
          carbs += meal.swapCarbs ?? meal.carbs;
          fat += meal.swapFat ?? meal.fat;
        }
      }
    }

    // Add food snaps
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
