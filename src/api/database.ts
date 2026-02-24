// api/database.ts — Supabase database helper functions
// Each function wraps a Supabase query with error handling and type mapping.

import { supabase } from "./supabase";
import type {
  BodyMeasurement,
  ChatMessage,
  DietaryPreferences,
  FoodSnap,
  FoodSnapAIEstimate,
  FoodSnapAmendedValues,
  Meal,
  MealPlan,
  ReadinessCheck,
  UserGoals,
  UserProfile,
  WarmUpCoolDownExercise,
  WaterEntry,
  WaterLog,
  WeeklySummary,
  WeightEntry,
  WorkoutPlan,
} from "../types";

// ─── Row types (Supabase snake_case) ────────────────────────────────────────

interface ProfileRow {
  id: string;
  name: string | null;
  age: number | null;
  gender: string | null;
  height_cm: number | null;
  current_weight_kg: number | null;
  target_weight_kg: number | null;
  fitness_history: string | null;
  past_sports: string[] | null;
  peak_fitness_level: string | null;
  current_activity_level: string | null;
  injuries: string[] | null;
  dietary_preferences: DietaryPreferences | null;
  goals: UserGoals | null;
  eating_context: { cooksForSelf: string; eatsOutFrequency: string } | null;
  workout_schedule: { daysPerWeek: string; timePreference: string } | null;
  equipment_available: string[] | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

interface WorkoutRow {
  id: string;
  user_id: string;
  date: string;
  exercises: unknown;
  status: string;
  is_rest_day: boolean;
  rest_day_type: string | null;
  ai_notes: string | null;
  summary: unknown;
  warm_up: unknown;
  cool_down: unknown;
  energy_level: number | null;
  readiness: ReadinessCheck | null;
  session_rpe: number | null;
  workout_started_at: string | null;
  created_at: string;
}

interface MealPlanRow {
  id: string;
  user_id: string;
  date: string;
  meals: unknown;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  created_at: string;
}

interface FoodSnapRow {
  id: string;
  user_id: string;
  meal_id: string | null;
  image_url: string | null;
  ai_estimate: FoodSnapAIEstimate;
  user_amended: boolean;
  amended_values: FoodSnapAmendedValues | null;
  created_at: string;
}

interface WaterLogRow {
  id: string;
  user_id: string;
  date: string;
  goal_ml: number;
  consumed_ml: number;
  entries: unknown;
}

interface ChatMessageRow {
  id: string;
  user_id: string;
  role: string;
  content: string;
  image_url: string | null;
  actions_taken: string[] | null;
  created_at: string;
}

interface WeightEntryRow {
  id: string;
  user_id: string;
  weight_kg: number;
  date: string;
  created_at: string;
}

interface BodyMeasurementRow {
  id: string;
  user_id: string;
  date: string;
  waist_cm: number | null;
  chest_cm: number | null;
  arms_cm: number | null;
  notes: string | null;
  created_at: string;
}

interface WeeklySummaryRow {
  id: string;
  user_id: string;
  week_start_date: string;
  summary_text: string | null;
  insights: string[] | null;
  created_at: string;
}

// ─── Mappers: DB row → App type ─────────────────────────────────────────────

function toProfile(row: ProfileRow): UserProfile {
  return {
    userId: row.id,
    name: row.name ?? "",
    age: row.age ?? 0,
    gender: row.gender ?? "",
    height: row.height_cm ?? 0,
    currentWeight: row.current_weight_kg ?? 0,
    targetWeight: row.target_weight_kg ?? 0,
    fitnessHistory: row.fitness_history ?? "",
    pastSports: row.past_sports ?? [],
    peakFitnessLevel: row.peak_fitness_level ?? "",
    currentActivityLevel: row.current_activity_level ?? "",
    injuries: row.injuries ?? [],
    dietaryPreferences: row.dietary_preferences ?? {
      type: "non-veg",
      allergies: [],
      dislikes: [],
      cuisineRegion: "",
    },
    goals: row.goals ?? {
      primaryGoal: "",
      targetTimeline: "",
      targetWeight: 0,
    },
    eatingContext: row.eating_context ?? undefined,
    workoutSchedule: row.workout_schedule ?? undefined,
    equipmentAvailable: row.equipment_available ?? [],
    onboardingCompleted: row.onboarding_completed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function fromProfile(
  userId: string,
  data: Partial<UserProfile>,
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: userId,
    updated_at: new Date().toISOString(),
  };
  if (data.name !== undefined) row.name = data.name;
  if (data.age !== undefined) row.age = data.age;
  if (data.gender !== undefined) row.gender = data.gender;
  if (data.height !== undefined) row.height_cm = data.height;
  if (data.currentWeight !== undefined)
    row.current_weight_kg = data.currentWeight;
  if (data.targetWeight !== undefined) row.target_weight_kg = data.targetWeight;
  if (data.fitnessHistory !== undefined)
    row.fitness_history = data.fitnessHistory;
  if (data.pastSports !== undefined) row.past_sports = data.pastSports;
  if (data.peakFitnessLevel !== undefined)
    row.peak_fitness_level = data.peakFitnessLevel;
  if (data.currentActivityLevel !== undefined)
    row.current_activity_level = data.currentActivityLevel;
  if (data.injuries !== undefined) row.injuries = data.injuries;
  if (data.dietaryPreferences !== undefined)
    row.dietary_preferences = data.dietaryPreferences;
  if (data.goals !== undefined) row.goals = data.goals;
  if (data.eatingContext !== undefined) row.eating_context = data.eatingContext;
  if (data.workoutSchedule !== undefined)
    row.workout_schedule = data.workoutSchedule;
  if (data.equipmentAvailable !== undefined)
    row.equipment_available = data.equipmentAvailable;
  if (data.onboardingCompleted !== undefined)
    row.onboarding_completed = data.onboardingCompleted;
  return row;
}

function toWorkout(row: WorkoutRow): WorkoutPlan {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    exercises: (Array.isArray(row.exercises)
      ? row.exercises
      : []) as WorkoutPlan["exercises"],
    warmUp: (Array.isArray(row.warm_up)
      ? row.warm_up
      : []) as WarmUpCoolDownExercise[],
    coolDown: (Array.isArray(row.cool_down)
      ? row.cool_down
      : []) as WarmUpCoolDownExercise[],
    status: row.status as WorkoutPlan["status"],
    isRestDay: row.is_rest_day,
    restDayType: row.rest_day_type as WorkoutPlan["restDayType"],
    energyLevel: (row.energy_level as WorkoutPlan["energyLevel"]) ?? undefined,
    readiness: row.readiness ?? undefined,
    sessionRPE: row.session_rpe ?? undefined,
    workoutStartedAt: row.workout_started_at ?? undefined,
    aiNotes: row.ai_notes ?? "",
    createdAt: row.created_at,
  };
}

function toMealPlan(row: MealPlanRow): MealPlan {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    meals: (Array.isArray(row.meals) ? row.meals : []) as Meal[],
    totalCalories: row.total_calories,
    totalProtein: row.total_protein,
    totalCarbs: row.total_carbs,
    totalFat: row.total_fat,
    createdAt: row.created_at,
  };
}

function toFoodSnap(row: FoodSnapRow): FoodSnap {
  return {
    id: row.id,
    userId: row.user_id,
    mealId: row.meal_id ?? undefined,
    imageUri: row.image_url ?? "",
    aiEstimate: row.ai_estimate,
    userAmended: row.user_amended,
    amendedValues: row.amended_values ?? undefined,
    createdAt: row.created_at,
  };
}

function toWaterLog(row: WaterLogRow): WaterLog {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    goal: row.goal_ml,
    consumed: row.consumed_ml,
    entries: (Array.isArray(row.entries) ? row.entries : []) as WaterEntry[],
  };
}

function toChatMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    userId: row.user_id,
    role: row.role as ChatMessage["role"],
    content: row.content,
    imageUri: row.image_url ?? undefined,
    actionsTaken: row.actions_taken ?? [],
    createdAt: row.created_at,
  };
}

function toWeightEntry(row: WeightEntryRow): WeightEntry {
  return {
    id: row.id,
    userId: row.user_id,
    weight: row.weight_kg,
    date: row.date,
  };
}

function toBodyMeasurement(row: BodyMeasurementRow): BodyMeasurement {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    waist: row.waist_cm ?? 0,
    chest: row.chest_cm ?? 0,
    arms: row.arms_cm ?? 0,
    notes: row.notes ?? "",
  };
}

function toWeeklySummary(row: WeeklySummaryRow): WeeklySummary {
  return {
    id: row.id,
    userId: row.user_id,
    weekStartDate: row.week_start_date,
    summaryText: row.summary_text ?? "",
    insights: row.insights ?? [],
    createdAt: row.created_at,
  };
}

export async function getProfile(userId: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (error) throw error;
    return data ? toProfile(data as ProfileRow) : null;
  } catch (e) {
    console.error("[DB] getProfile error:", e);
    return null;
  }
}

export async function upsertProfile(
  userId: string,
  data: Partial<UserProfile>,
): Promise<UserProfile | null> {
  try {
    const row = fromProfile(userId, data);
    const { data: result, error } = await supabase
      .from("profiles")
      .upsert(row, { onConflict: "id" })
      .select()
      .single();
    if (error) throw error;
    return result ? toProfile(result as ProfileRow) : null;
  } catch (e) {
    console.error("[DB] upsertProfile error:", e);
    return null;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Workout
// ═════════════════════════════════════════════════════════════════════════════

export async function getTodayWorkout(
  userId: string,
  date: string,
): Promise<WorkoutPlan | null> {
  try {
    const { data, error } = await supabase
      .from("workout_plans")
      .select("*")
      .eq("user_id", userId)
      .eq("date", date)
      .single();
    if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows
    return data ? toWorkout(data as WorkoutRow) : null;
  } catch (e) {
    console.error("[DB] getTodayWorkout error:", e);
    return null;
  }
}

export async function upsertWorkout(
  userId: string,
  workout: WorkoutPlan,
): Promise<WorkoutPlan | null> {
  try {
    const { data, error } = await supabase
      .from("workout_plans")
      .upsert(
        {
          id: workout.id,
          user_id: userId,
          date: workout.date,
          exercises: workout.exercises,
          warm_up: workout.warmUp ?? [],
          cool_down: workout.coolDown ?? [],
          energy_level: workout.energyLevel ?? null,
          status: workout.status,
          is_rest_day: workout.isRestDay,
          rest_day_type: workout.restDayType,
          ai_notes: workout.aiNotes,
          created_at: workout.createdAt,
        },
        { onConflict: "user_id,date" },
      )
      .select()
      .single();
    if (error) throw error;
    return data ? toWorkout(data as WorkoutRow) : null;
  } catch (e) {
    console.error("[DB] upsertWorkout error:", e);
    return null;
  }
}

export async function updateWorkoutStatus(
  workoutId: string,
  status: WorkoutPlan["status"],
  summary?: Record<string, unknown> | null,
): Promise<void> {
  try {
    const update: Record<string, unknown> = { status };
    if (summary !== undefined) update.summary = summary;
    const { error } = await supabase
      .from("workout_plans")
      .update(update)
      .eq("id", workoutId);
    if (error) throw error;
  } catch (e) {
    console.error("[DB] updateWorkoutStatus error:", e);
  }
}

export async function updateExerciseFeedback(
  workoutId: string,
  exercises: WorkoutPlan["exercises"],
): Promise<void> {
  try {
    const { error } = await supabase
      .from("workout_plans")
      .update({ exercises })
      .eq("id", workoutId);
    if (error) throw error;
  } catch (e) {
    console.error("[DB] updateExerciseFeedback error:", e);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Nutrition
// ═════════════════════════════════════════════════════════════════════════════

export async function getTodayMealPlan(
  userId: string,
  date: string,
): Promise<MealPlan | null> {
  try {
    const { data, error } = await supabase
      .from("meal_plans")
      .select("*")
      .eq("user_id", userId)
      .eq("date", date)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    return data ? toMealPlan(data as MealPlanRow) : null;
  } catch (e) {
    console.error("[DB] getTodayMealPlan error:", e);
    return null;
  }
}

export async function getRecentMealPlans(
  userId: string,
  days: number,
): Promise<MealPlan[]> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const { data, error } = await supabase
      .from("meal_plans")
      .select("*")
      .eq("user_id", userId)
      .gte("date", startDate.toISOString().split("T")[0])
      .order("date", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => toMealPlan(row as MealPlanRow));
  } catch (e) {
    console.error("[DB] getRecentMealPlans error:", e);
    return [];
  }
}

export async function upsertMealPlan(
  userId: string,
  plan: MealPlan,
): Promise<MealPlan | null> {
  try {
    const { data, error } = await supabase
      .from("meal_plans")
      .upsert(
        {
          id: plan.id,
          user_id: userId,
          date: plan.date,
          meals: plan.meals,
          total_calories: plan.totalCalories,
          total_protein: plan.totalProtein,
          total_carbs: plan.totalCarbs,
          total_fat: plan.totalFat,
          created_at: plan.createdAt,
        },
        { onConflict: "user_id,date" },
      )
      .select()
      .single();
    if (error) throw error;
    return data ? toMealPlan(data as MealPlanRow) : null;
  } catch (e) {
    console.error("[DB] upsertMealPlan error:", e);
    return null;
  }
}

export async function updateMealFeedback(
  mealPlanId: string,
  meals: Meal[],
): Promise<void> {
  try {
    const { error } = await supabase
      .from("meal_plans")
      .update({ meals })
      .eq("id", mealPlanId);
    if (error) throw error;
  } catch (e) {
    console.error("[DB] updateMealFeedback error:", e);
  }
}

export async function saveFoodSnap(
  userId: string,
  snap: FoodSnap,
): Promise<FoodSnap | null> {
  try {
    const { data, error } = await supabase
      .from("food_snaps")
      .insert({
        user_id: userId,
        meal_id: snap.mealId ?? null,
        image_url: snap.imageUri,
        ai_estimate: snap.aiEstimate,
        user_amended: snap.userAmended,
        amended_values: snap.amendedValues ?? null,
        created_at: snap.createdAt,
      })
      .select()
      .single();
    if (error) throw error;
    return data ? toFoodSnap(data as FoodSnapRow) : null;
  } catch (e) {
    console.error("[DB] saveFoodSnap error:", e);
    return null;
  }
}

export async function getTodayFoodSnaps(
  userId: string,
  date: string,
): Promise<FoodSnap[]> {
  try {
    const { data, error } = await supabase
      .from("food_snaps")
      .select("*")
      .eq("user_id", userId)
      .gte("created_at", `${date}T00:00:00`)
      .lt("created_at", `${date}T23:59:59.999`)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => toFoodSnap(row as FoodSnapRow));
  } catch (e) {
    console.error("[DB] getTodayFoodSnaps error:", e);
    return [];
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Water
// ═════════════════════════════════════════════════════════════════════════════

export async function getTodayWaterLog(
  userId: string,
  date: string,
): Promise<WaterLog | null> {
  try {
    const { data, error } = await supabase
      .from("water_logs")
      .select("*")
      .eq("user_id", userId)
      .eq("date", date)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    return data ? toWaterLog(data as WaterLogRow) : null;
  } catch (e) {
    console.error("[DB] getTodayWaterLog error:", e);
    return null;
  }
}

export async function upsertWaterLog(
  userId: string,
  waterLog: WaterLog,
): Promise<WaterLog | null> {
  try {
    const { data, error } = await supabase
      .from("water_logs")
      .upsert(
        {
          id: waterLog.id,
          user_id: userId,
          date: waterLog.date,
          goal_ml: waterLog.goal,
          consumed_ml: waterLog.consumed,
          entries: waterLog.entries,
        },
        { onConflict: "user_id,date" },
      )
      .select()
      .single();
    if (error) throw error;
    return data ? toWaterLog(data as WaterLogRow) : null;
  } catch (e) {
    console.error("[DB] upsertWaterLog error:", e);
    return null;
  }
}

/**
 * Get recent exercise performance history for progressive overload display.
 * Returns a Map of exerciseName → most recent completed performance.
 */
export async function getRecentExerciseHistory(
  userId: string,
  days: number = 14,
): Promise<
  Map<string, { weight?: number; reps?: number; sets?: number; date: string }>
> {
  const result = new Map<
    string,
    { weight?: number; reps?: number; sets?: number; date: string }
  >();
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const { data, error } = await supabase
      .from("workout_plans")
      .select("date, exercises")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("date", startDate.toISOString().split("T")[0])
      .order("date", { ascending: false });
    if (error) throw error;
    for (const row of data ?? []) {
      const exercises = Array.isArray(row.exercises) ? row.exercises : [];
      for (const ex of exercises) {
        const fb = (ex as Record<string, unknown>).feedback as string;
        if (
          (fb === "completed" || fb === "too-easy") &&
          !result.has((ex as Record<string, unknown>).name as string)
        ) {
          const e = ex as Record<string, unknown>;
          result.set(e.name as string, {
            weight: (e.actualWeight ?? e.weight) as number | undefined,
            reps: (e.actualReps ?? e.reps) as number | undefined,
            sets: (e.actualSets ?? e.sets) as number | undefined,
            date: row.date,
          });
        }
      }
    }
  } catch (e) {
    console.error("[DB] getRecentExerciseHistory error:", e);
  }
  return result;
}

/**
 * Get muscle group workout frequency over the last N days.
 * Returns Map<muscleGroup, count> to detect imbalances.
 */
export async function getMuscleGroupFrequency(
  userId: string,
  days: number = 7,
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const { data, error } = await supabase
      .from("workout_plans")
      .select("exercises")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("date", startDate.toISOString().split("T")[0]);
    if (error) throw error;
    for (const row of data ?? []) {
      const exercises = Array.isArray(row.exercises) ? row.exercises : [];
      for (const ex of exercises) {
        const group = (ex as Record<string, unknown>).muscleGroup as string;
        if (group) {
          result.set(group, (result.get(group) ?? 0) + 1);
        }
      }
    }
  } catch (e) {
    console.error("[DB] getMuscleGroupFrequency error:", e);
  }
  return result;
}

/**
 * Get recent session RPE values for fatigue monitoring.
 * Returns array of {date, rpe} for the last N days of completed workouts with RPE.
 */
export async function getRecentSessionRPE(
  userId: string,
  days: number = 7,
): Promise<{ date: string; rpe: number }[]> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const { data, error } = await supabase
      .from("workout_plans")
      .select("date, session_rpe")
      .eq("user_id", userId)
      .eq("status", "completed")
      .not("session_rpe", "is", null)
      .gte("date", startDate.toISOString().split("T")[0])
      .order("date", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      date: row.date as string,
      rpe: row.session_rpe as number,
    }));
  } catch (e) {
    console.error("[DB] getRecentSessionRPE error:", e);
    return [];
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Personal Records
// ═════════════════════════════════════════════════════════════════════════════

export interface PersonalRecord {
  exerciseName: string;
  weightKg: number;
  reps: number;
  date: string;
}

/**
 * Fetch all personal records for the user.
 * Returns Map<exerciseName, {weightKg, reps, date}>.
 */
export async function getPersonalRecords(
  userId: string,
): Promise<Map<string, PersonalRecord>> {
  const result = new Map<string, PersonalRecord>();
  try {
    const { data, error } = await supabase
      .from("personal_records")
      .select("exercise_name, weight_kg, reps, date")
      .eq("user_id", userId);
    if (error) throw error;
    for (const row of data ?? []) {
      result.set(row.exercise_name as string, {
        exerciseName: row.exercise_name as string,
        weightKg: (row.weight_kg as number) ?? 0,
        reps: (row.reps as number) ?? 0,
        date: row.date as string,
      });
    }
  } catch (e) {
    console.error("[DB] getPersonalRecords error:", e);
  }
  return result;
}

/**
 * Upsert a personal record (one per user+exercise).
 */
export async function upsertPersonalRecord(
  userId: string,
  exerciseName: string,
  weightKg: number,
  reps: number,
  date: string,
): Promise<void> {
  try {
    const { error } = await supabase.from("personal_records").upsert(
      {
        user_id: userId,
        exercise_name: exerciseName,
        weight_kg: weightKg,
        reps,
        date,
      },
      { onConflict: "user_id,exercise_name" },
    );
    if (error) throw error;
  } catch (e) {
    console.error("[DB] upsertPersonalRecord error:", e);
  }
}

/**
 * Get workout history (completed/skipped workouts) with pagination.
 */
export async function getWorkoutHistory(
  userId: string,
  limit: number = 20,
  offset: number = 0,
): Promise<WorkoutPlan[]> {
  try {
    const { data, error } = await supabase
      .from("workout_plans")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["completed", "skipped"])
      .order("date", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return (data ?? []).map((row) => toWorkout(row as WorkoutRow));
  } catch (e) {
    console.error("[DB] getWorkoutHistory error:", e);
    return [];
  }
}

/**
 * Get completed/in-progress workout dates for the last N days.
 * Used to compute streak and active-day dots on HomeScreen.
 */
export async function getRecentWorkoutDates(
  userId: string,
  days: number,
): Promise<{ date: string; status: string }[]> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const { data, error } = await supabase
      .from("workout_plans")
      .select("date, status")
      .eq("user_id", userId)
      .gte("date", startDate.toISOString().split("T")[0])
      .in("status", ["completed", "in-progress"])
      .order("date", { ascending: false });
    if (error) throw error;
    return (data ?? []) as { date: string; status: string }[];
  } catch (e) {
    console.error("[DB] getRecentWorkoutDates error:", e);
    return [];
  }
}

/**
 * Delete today's workout and meal plans so they can be regenerated.
 * Water log is preserved since users may have already logged water.
 */
export async function deleteTodayPlans(
  userId: string,
  date: string,
): Promise<void> {
  try {
    await Promise.all([
      supabase
        .from("workout_plans")
        .delete()
        .eq("user_id", userId)
        .eq("date", date),
      supabase
        .from("meal_plans")
        .delete()
        .eq("user_id", userId)
        .eq("date", date),
    ]);
  } catch (e) {
    console.error("[DB] deleteTodayPlans error:", e);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Chat
// ═════════════════════════════════════════════════════════════════════════════

export async function getChatMessages(
  userId: string,
  limit = 50,
): Promise<ChatMessage[]> {
  try {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map((row) => toChatMessage(row as ChatMessageRow));
  } catch (e) {
    console.error("[DB] getChatMessages error:", e);
    return [];
  }
}

export async function saveChatMessage(
  userId: string,
  message: ChatMessage,
): Promise<ChatMessage | null> {
  try {
    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        user_id: userId,
        role: message.role,
        content: message.content,
        image_url: message.imageUri ?? null,
        actions_taken: message.actionsTaken,
        created_at: message.createdAt,
      })
      .select()
      .single();
    if (error) throw error;
    return data ? toChatMessage(data as ChatMessageRow) : null;
  } catch (e) {
    console.error("[DB] saveChatMessage error:", e);
    return null;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Progress
// ═════════════════════════════════════════════════════════════════════════════

export async function getWeightEntries(userId: string): Promise<WeightEntry[]> {
  try {
    const { data, error } = await supabase
      .from("weight_entries")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => toWeightEntry(row as WeightEntryRow));
  } catch (e) {
    console.error("[DB] getWeightEntries error:", e);
    return [];
  }
}

export async function saveWeightEntry(
  userId: string,
  weight: number,
  date: string,
): Promise<WeightEntry | null> {
  try {
    const { data, error } = await supabase
      .from("weight_entries")
      .insert({ user_id: userId, weight_kg: weight, date })
      .select()
      .single();
    if (error) throw error;
    return data ? toWeightEntry(data as WeightEntryRow) : null;
  } catch (e) {
    console.error("[DB] saveWeightEntry error:", e);
    return null;
  }
}

export async function getMeasurements(
  userId: string,
): Promise<BodyMeasurement[]> {
  try {
    const { data, error } = await supabase
      .from("body_measurements")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) =>
      toBodyMeasurement(row as BodyMeasurementRow),
    );
  } catch (e) {
    console.error("[DB] getMeasurements error:", e);
    return [];
  }
}

export async function saveMeasurement(
  userId: string,
  m: BodyMeasurement,
): Promise<BodyMeasurement | null> {
  try {
    const { data, error } = await supabase
      .from("body_measurements")
      .insert({
        user_id: userId,
        date: m.date,
        waist_cm: m.waist,
        chest_cm: m.chest,
        arms_cm: m.arms,
        notes: m.notes,
      })
      .select()
      .single();
    if (error) throw error;
    return data ? toBodyMeasurement(data as BodyMeasurementRow) : null;
  } catch (e) {
    console.error("[DB] saveMeasurement error:", e);
    return null;
  }
}

export async function getWeeklySummaries(
  userId: string,
): Promise<WeeklySummary[]> {
  try {
    const { data, error } = await supabase
      .from("weekly_summaries")
      .select("*")
      .eq("user_id", userId)
      .order("week_start_date", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => toWeeklySummary(row as WeeklySummaryRow));
  } catch (e) {
    console.error("[DB] getWeeklySummaries error:", e);
    return [];
  }
}

export async function saveWeeklySummary(
  userId: string,
  weekStartDate: string,
  summaryText: string,
  insights: string[],
): Promise<WeeklySummary | null> {
  try {
    const { data, error } = await supabase
      .from("weekly_summaries")
      .upsert(
        {
          user_id: userId,
          week_start_date: weekStartDate,
          summary_text: summaryText,
          insights,
        },
        { onConflict: "user_id,week_start_date" },
      )
      .select()
      .single();
    if (error) throw error;
    return data ? toWeeklySummary(data as WeeklySummaryRow) : null;
  } catch (e) {
    console.error("[DB] saveWeeklySummary error:", e);
    return null;
  }
}
