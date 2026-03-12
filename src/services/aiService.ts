// services/aiService.ts — AI orchestration layer
// Calls Supabase Edge Functions for all AI interactions.

import { supabase } from '../api/supabase';
import { imageUriToBase64 } from '../utils/imageUtils';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config/env';
import type { ChatMessage, FoodSnap, MealPlan, ReadinessCheck, UserProfile, WaterLog, WorkoutPlan } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WorkoutChange {
  exerciseName: string;
  sets?: number;
  reps?: number;
  restSeconds?: number;
  weight?: number;
}

export interface AIResponse {
  message: string;
  actionsTaken: string[];
  workoutChanges?: WorkoutChange[];
}

export interface AIContext {
  profile: UserProfile;
  todayWorkout: WorkoutPlan | null;
  todayMealPlan: MealPlan | null;
  todayWaterLog: WaterLog | null;
  recentMessages: ChatMessage[];
}

export interface FoodAnalysisResult {
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: 'low' | 'medium' | 'high';
  suggestions: string;
}

// ─── Edge Function caller ───────────────────────────────────────────────────

async function callEdgeFunction<T>(functionName: string, body: object): Promise<T> {
  const url = `${SUPABASE_URL}/functions/v1/${functionName}`;
  console.log(`📡 Calling Edge Function: ${functionName}... URL: ${url}`);

  // Use anon key — edge functions handle their own auth via the request body
  const token = SUPABASE_ANON_KEY;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`📡 ❌ Edge Function ${functionName} failed: HTTP ${response.status}`, errorBody);
    throw new Error(`Edge Function ${functionName} failed: ${response.status} ${errorBody}`);
  }

  const data = await response.json();
  const preview = JSON.stringify(data).slice(0, 200);
  console.log(`📡 ✅ Edge Function ${functionName} response received:`, preview);
  return data as T;
}

// ─── Coach Chat ─────────────────────────────────────────────────────────────

export async function sendCoachMessage(
  userMessage: string,
  imageUri: string | undefined,
  context: AIContext,
): Promise<AIResponse> {
  console.log('💬 sendCoachMessage called. Message:', userMessage.slice(0, 100));
  try {
    let imageBase64: string | undefined;
    if (imageUri) {
      const b64 = await imageUriToBase64(imageUri);
      if (b64) imageBase64 = b64;
    }

    const result = await callEdgeFunction<AIResponse>('coach-chat', {
      message: userMessage,
      imageBase64,
      context: {
        profile: context.profile,
        todayWorkout: context.todayWorkout,
        todayMealPlan: context.todayMealPlan,
        todayWaterLog: context.todayWaterLog
          ? { consumed: context.todayWaterLog.consumed, goal: context.todayWaterLog.goal }
          : null,
        recentMessages: context.recentMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      },
    });

    return result;
  } catch (e) {
    console.error('[aiService] sendCoachMessage failed:', e);
    throw e;
  }
}

// ─── Food Photo Analysis ────────────────────────────────────────────────────

export async function analyzeFoodPhoto(imageUri: string): Promise<FoodAnalysisResult> {
  console.log('📸 analyzeFoodPhoto called');
  try {
    const imageBase64 = await imageUriToBase64(imageUri);
    if (!imageBase64) throw new Error('Failed to convert image to base64');

    const result = await callEdgeFunction<FoodAnalysisResult>('analyze-food', {
      imageBase64,
    });

    return result;
  } catch (e) {
    console.error('[aiService] analyzeFoodPhoto failed:', e);
    throw e;
  }
}

// ─── Estimate Swap Nutrition ────────────────────────────────────────────────

export interface SwapNutritionEstimate {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export async function estimateSwapNutrition(foodDescription: string): Promise<SwapNutritionEstimate> {
  console.log('🔄 estimateSwapNutrition called:', foodDescription);
  try {
    const result = await callEdgeFunction<SwapNutritionEstimate>('estimate-swap-nutrition', {
      foodDescription,
    });
    return result;
  } catch (e) {
    console.error('[aiService] estimateSwapNutrition failed:', e);
    throw e;
  }
}

// ─── Generate Daily Workout ─────────────────────────────────────────────────

export async function generateDailyWorkout(
  profile: UserProfile,
  recentWorkouts: WorkoutPlan[],
  recentFeedback: { exerciseName: string; feedback: string; prescribedWeight?: number; actualWeight?: number; actualReps?: number }[],
  chatContext: string[],
  options?: { weekNumber?: number; missedDays?: number; energyLevel?: number; readiness?: ReadinessCheck; muscleGroupFrequency?: Record<string, number>; recentRPE?: { date: string; rpe: number }[]; equipmentAvailable?: string[] },
): Promise<{
  exercises: { name: string; muscleGroup: string; sets: number; reps: number; restSeconds: number; order: number; weight?: number; formCues?: string[] }[];
  warmUp?: { name: string; duration?: string; description?: string; order: number }[];
  coolDown?: { name: string; duration?: string; description?: string; order: number }[];
  isRestDay: boolean;
  restDayType: string | null;
  aiNotes: string;
}> {
  console.log('🏋️ generateDailyWorkout called');
  return callEdgeFunction('generate-workout', {
    profile,
    previousWorkouts: recentWorkouts,
    recentFeedback,
    chatContext,
    weekNumber: options?.weekNumber,
    missedDays: options?.missedDays,
    energyLevel: options?.energyLevel,
    readiness: options?.readiness,
    muscleGroupFrequency: options?.muscleGroupFrequency,
    recentRPE: options?.recentRPE,
    equipmentAvailable: options?.equipmentAvailable,
  });
}

// ─── Generate Daily Meal Plan ───────────────────────────────────────────────

export async function generateDailyMealPlan(
  profile: UserProfile,
  todayWorkout: WorkoutPlan | null,
  recentMealFeedback: { mealId: string; feedback: string }[],
  recentFoodSnaps: FoodSnap[],
  chatContext: string[],
  recentMealDescriptions?: string[], // NEW: To avoid meal repetition
): Promise<{
  meals: { type: string; name: string; description: string; calories: number; protein: number; carbs: number; fat: number }[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}> {
  console.log('🍽️ generateDailyMealPlan called');
  console.log('🍽️ Recent meals to avoid:', recentMealDescriptions?.length ?? 0);
  return callEdgeFunction('generate-meal-plan', {
    profile,
    todayWorkout,
    recentMealFeedback,
    recentFoodSnaps,
    chatContext,
    recentMealDescriptions: recentMealDescriptions ?? [], // Pass to Edge Function
  });
}

// ─── Suggest Exercise Swap ──────────────────────────────────────────────────

export interface SwapAlternative {
  name: string;
  muscleGroup: string;
  sets: number;
  reps: number;
  weight: number | null;
  formCues: string[];
  reason: string;
}

export async function suggestExerciseSwap(
  exerciseName: string,
  muscleGroup: string,
  equipmentAvailable: string[],
  currentExercises: string[],
): Promise<{ alternatives: SwapAlternative[] }> {
  console.log('🔄 suggestExerciseSwap called for:', exerciseName);
  return callEdgeFunction('suggest-swap', {
    exerciseName,
    muscleGroup,
    equipmentAvailable,
    currentExercises,
  });
}

// ─── Generate Weekly Summary ────────────────────────────────────────────────

export async function generateWeeklySummary(weekData: {
  profile: UserProfile;
  weekWorkouts: WorkoutPlan[];
  weekMealPlans: MealPlan[];
  weekWaterLogs: WaterLog[];
  weightEntries: { weight: number; date: string }[];
  chatMessages: { role: string; content: string }[];
}): Promise<{ summaryText: string; insights: string[] }> {
  console.log('📊 generateWeeklySummary called');
  return callEdgeFunction('weekly-summary', weekData);
}

