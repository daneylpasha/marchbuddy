// Registers all database write operations so the offline queue can replay them.
// Must be called once at app startup (e.g. in _layout or App).

import { offlineQueue } from './offlineQueue';
import {
  upsertProfile,
  updateWorkoutStatus,
  updateExerciseFeedback,
  updateMealFeedback,
  saveFoodSnap,
  upsertWaterLog,
  saveWeightEntry,
  saveMeasurement,
  saveWeeklySummary,
  upsertPersonalRecord,
} from '../api/database';
import { supabase } from '../api/supabase';

export function registerOfflineActions() {
  offlineQueue.registerAction('upsertProfile', (userId: string, data: any) =>
    upsertProfile(userId, data).then(() => {}),
  );

  offlineQueue.registerAction(
    'updateWorkoutStatus',
    (workoutId: string, status: string, summary?: any) =>
      updateWorkoutStatus(workoutId, status as any, summary),
  );

  offlineQueue.registerAction('updateExerciseFeedback', (workoutId: string, exercises: any) =>
    updateExerciseFeedback(workoutId, exercises),
  );

  offlineQueue.registerAction('updateMealFeedback', (mealPlanId: string, meals: any) =>
    updateMealFeedback(mealPlanId, meals),
  );

  offlineQueue.registerAction('saveFoodSnap', (userId: string, snap: any) =>
    saveFoodSnap(userId, snap).then(() => {}),
  );

  offlineQueue.registerAction('upsertWaterLog', (userId: string, waterLog: any) =>
    upsertWaterLog(userId, waterLog).then(() => {}),
  );

  offlineQueue.registerAction('saveWeightEntry', (userId: string, weight: number, date: string) =>
    saveWeightEntry(userId, weight, date).then(() => {}),
  );

  offlineQueue.registerAction('saveMeasurement', (userId: string, measurement: any) =>
    saveMeasurement(userId, measurement).then(() => {}),
  );

  offlineQueue.registerAction(
    'saveWeeklySummary',
    (userId: string, weekStart: string, text: string, insights: string[]) =>
      saveWeeklySummary(userId, weekStart, text, insights).then(() => {}),
  );

  offlineQueue.registerAction(
    'upsertPersonalRecord',
    (userId: string, exerciseName: string, weight: number, reps: number, date: string) =>
      upsertPersonalRecord(userId, exerciseName, weight, reps, date),
  );

  offlineQueue.registerAction(
    'updateWorkoutColumn',
    async (workoutId: string, column: string, value: any) => {
      const { error } = await supabase
        .from('workout_plans')
        .update({ [column]: value })
        .eq('id', workoutId);
      if (error) throw error;
    },
  );

  offlineQueue.registerAction(
    'updateWorkoutColumns',
    async (workoutId: string, updates: Record<string, any>) => {
      const { error } = await supabase.from('workout_plans').update(updates).eq('id', workoutId);
      if (error) throw error;
    },
  );
}
