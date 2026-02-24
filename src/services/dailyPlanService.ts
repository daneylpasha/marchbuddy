// services/dailyPlanService.ts — Orchestrates daily plan generation

import { getToday, getWeekNumber, computeMissedDays } from '../utils/dateUtils';
import { getProfile } from '../api/database';
import {
  getTodayWorkout,
  upsertWorkout,
  getTodayMealPlan,
  getRecentMealPlans,
  upsertMealPlan,
  getTodayWaterLog,
  upsertWaterLog,
  getChatMessages,
  getMuscleGroupFrequency,
  getRecentSessionRPE,
} from '../api/database';
import { generateDailyWorkout, generateDailyMealPlan } from './aiService';
import type { MealPlan, WorkoutPlan, WaterLog } from '../types';
import { supabase } from '../api/supabase';
import { APP_CONFIG } from '../config/appConfig';
import { generateUUID } from '../utils/uuid';
import { MOCK_MODE } from '../mock';

interface DailyPlanResult {
  workout: WorkoutPlan | null;
  mealPlan: MealPlan | null;
  waterLog: WaterLog;
  status: 'generated' | 'failed' | 'existing';
}

/**
 * Fetch last N days of workouts for context.
 */
async function getRecentWorkouts(userId: string, days: number): Promise<WorkoutPlan[]> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const { data, error } = await supabase
      .from('workout_plans')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: false });
    if (error) throw error;
    // Return raw data — the AI service accepts Record<string, unknown>[]
    return (data ?? []) as unknown as WorkoutPlan[];
  } catch {
    return [];
  }
}

export async function generateTodaysPlan(userId: string): Promise<DailyPlanResult> {
  const today = getToday();

  // Skip all DB/AI calls in mock mode
  if (MOCK_MODE) {
    return {
      workout: null,
      mealPlan: null,
      waterLog: { id: generateUUID(), userId, date: today, goal: 2500, consumed: 0, entries: [] },
      status: 'existing',
    };
  }

  console.log('🏋️ Generating today\'s plan for user:', userId);

  try {
    // Check if plans already exist
    console.log('🏋️ Checking existing plans for date:', today);
    const [existingWorkout, existingMealPlan, existingWaterLog] = await Promise.all([
      getTodayWorkout(userId, today),
      getTodayMealPlan(userId, today),
      getTodayWaterLog(userId, today),
    ]);

    console.log('🏋️ Existing plans:', {
      workout: !!existingWorkout,
      mealPlan: !!existingMealPlan,
      waterLog: !!existingWaterLog,
    });

    // If all three exist, return them
    if (existingWorkout && existingMealPlan && existingWaterLog) {
      console.log('🏋️ ✅ All plans already exist, returning existing');
      return {
        workout: existingWorkout,
        mealPlan: existingMealPlan,
        waterLog: existingWaterLog,
        status: 'existing',
      };
    }

    // Fetch context for AI generation
    const [profile, recentWorkouts, recentMessages] = await Promise.all([
      getProfile(userId),
      getRecentWorkouts(userId, APP_CONFIG.MAX_WORKOUT_HISTORY_DAYS),
      getChatMessages(userId, APP_CONFIG.MAX_CHAT_HISTORY_FOR_CONTEXT),
    ]);

    if (!profile) {
      throw new Error('Profile not found');
    }

    // Extract recent feedback from workouts (enriched with progressive overload data)
    const recentFeedback = recentWorkouts
      .flatMap((w) =>
        (w.exercises ?? [])
          .filter((e) => e.feedback)
          .map((e) => ({
            exerciseName: e.name,
            feedback: e.feedback as string,
            prescribedWeight: e.weight,
            actualWeight: e.actualWeight,
            actualReps: e.actualReps,
          })),
      );

    // Compute context for AI generation
    const weekNumber = getWeekNumber(profile.createdAt);
    const missedDays = computeMissedDays(
      recentWorkouts.map((w) => ({ date: w.date, status: w.status })),
    );

    // Extract relevant chat context
    const chatContext = recentMessages
      .filter((m) => m.role === 'user')
      .map((m) => m.content)
      .slice(-10);

    // Muscle group balance (last 7 days) + recent RPE for fatigue monitoring
    const [muscleFreqMap, recentRPE] = await Promise.all([
      getMuscleGroupFrequency(userId, 7),
      getRecentSessionRPE(userId, 7),
    ]);
    const muscleGroupFrequency: Record<string, number> = {};
    muscleFreqMap.forEach((count, group) => { muscleGroupFrequency[group] = count; });

    // ── Generate workout if missing ────────────────────
    let workout = existingWorkout;
    if (!workout) {
      try {
        console.log('📡 Calling generate-workout Edge Function...');
        const generated = await generateDailyWorkout(
          profile,
          recentWorkouts,
          recentFeedback,
          chatContext,
          { weekNumber, missedDays, muscleGroupFrequency, recentRPE, equipmentAvailable: profile.equipmentAvailable },
        );

        workout = {
          id: generateUUID(),
          userId,
          date: today,
          exercises: generated.exercises.map((ex, i) => ({
            ...ex,
            id: `ex-${Date.now()}-${i}`,
            feedback: null,
            notes: '',
          })),
          warmUp: (generated.warmUp ?? []).map((ex, i) => ({
            ...ex,
            id: `wu-${Date.now()}-${i}`,
          })),
          coolDown: (generated.coolDown ?? []).map((ex, i) => ({
            ...ex,
            id: `cd-${Date.now()}-${i}`,
          })),
          status: 'pending' as const,
          isRestDay: generated.isRestDay,
          restDayType: generated.restDayType as WorkoutPlan['restDayType'],
          aiNotes: generated.aiNotes,
          createdAt: new Date().toISOString(),
        };

        // Save to Supabase
        await upsertWorkout(userId, workout);
      } catch (e) {
        console.warn('[dailyPlan] workout generation failed:', e);
        // workout stays null — UI will show empty state
      }
    }

    // ── Generate meal plan if missing ──────────────────
    let mealPlan = existingMealPlan;
    if (!mealPlan) {
      try {
        console.log('🍽️ Calling generate-meal-plan Edge Function...');
        // Fetch recent meal plans to provide variety and learn user preferences
        const recentMealPlans = await getRecentMealPlans(userId, 14); // Last 14 days

        // Extract meal feedback from recent plans (format: { mealId, feedback })
        const recentMealFeedback = recentMealPlans.flatMap((plan) =>
          plan.meals
            .filter((meal) => meal.feedback) // Only include meals with feedback
            .map((meal) => ({
              mealId: meal.id,
              feedback: meal.feedback as string,
            }))
        );

        // Extract recent meal descriptions to avoid repetition
        const recentMealDescriptions = recentMealPlans.flatMap((plan) =>
          plan.meals.map((meal) => `${meal.name}: ${meal.description}`)
        );

        console.log('🍽️ Recent meals to avoid:', recentMealDescriptions.slice(0, 5));

        const generated = await generateDailyMealPlan(
          profile,
          workout,
          recentMealFeedback,
          [], // Food snaps - will be handled separately
          chatContext,
          recentMealDescriptions, // NEW: Pass meal descriptions for variety
        );

        mealPlan = {
          id: generateUUID(),
          userId,
          date: today,
          meals: generated.meals.map((meal, i) => ({
            ...meal,
            id: `meal-${Date.now()}-${i}`,
            type: meal.type as MealPlan['meals'][number]['type'],
            feedback: null,
            isOffPlan: false,
          })),
          totalCalories: generated.totalCalories,
          totalProtein: generated.totalProtein,
          totalCarbs: generated.totalCarbs,
          totalFat: generated.totalFat,
          createdAt: new Date().toISOString(),
        };

        await upsertMealPlan(userId, mealPlan);
      } catch (e) {
        console.warn('[dailyPlan] meal plan generation failed:', e);
        // mealPlan stays null — UI will show empty state
      }
    }

    // ── Water log ──────────────────────────────────────
    let waterLog = existingWaterLog;
    if (!waterLog) {
      console.log('💧 Creating water log...');
      // Calculate goal based on weight and workout day
      const baseGoal = Math.round((profile.currentWeight ?? 70) * 33); // ~33ml per kg
      const isRest = workout?.isRestDay ?? false;
      const goal = isRest ? baseGoal : Math.round(baseGoal * 1.1);

      waterLog = {
        id: generateUUID(),
        userId,
        date: today,
        goal: Math.min(Math.max(goal, 2000), 4000), // clamp 2-4L
        consumed: 0,
        entries: [],
      };

      await upsertWaterLog(userId, waterLog);
    }

    const hasFailures = !workout || !mealPlan;
    const status = hasFailures ? 'failed' : 'generated';
    console.log(`🏋️ ${status === 'generated' ? '✅ Plan generated successfully' : '❌ Plan generation partial failure'}`, {
      hasWorkout: !!workout,
      hasMealPlan: !!mealPlan,
      hasWaterLog: !!waterLog,
      status,
    });
    return { workout, mealPlan, waterLog, status };
  } catch (e) {
    console.error('🏋️ ❌ generateTodaysPlan failed:', e);

    // Return minimal result — water log with defaults, null plan data
    const fallbackWater: WaterLog = {
      id: generateUUID(),
      userId,
      date: today,
      goal: 2500,
      consumed: 0,
      entries: [],
    };

    return {
      workout: null,
      mealPlan: null,
      waterLog: fallbackWater,
      status: 'failed',
    };
  }
}
