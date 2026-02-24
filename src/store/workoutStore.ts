import { create } from 'zustand';
import type { Exercise, ReadinessCheck, WorkoutPlan } from '../types';
import type { WorkoutChange } from '../services/aiService';
import { useAuthStore } from './authStore';
import {
  getTodayWorkout,
  upsertWorkout,
  updateWorkoutStatus,
  updateExerciseFeedback as dbUpdateExerciseFeedback,
  getRecentExerciseHistory,
  getPersonalRecords,
  upsertPersonalRecord,
  getWorkoutHistory,
} from '../api/database';
import type { PersonalRecord } from '../api/database';
import { supabase } from '../api/supabase';
import { MOCK_MODE } from '../mock';

interface WorkoutSummary {
  completed: number;
  skipped: number;
  tooEasy: number;
  tooHard: number;
  total: number;
}

export interface ExercisePerformance {
  weight?: number;
  reps?: number;
  sets?: number;
  date: string;
}

export interface PRCelebration {
  exerciseName: string;
  newWeight: number;
  newReps: number;
  previousWeight?: number;
  previousReps?: number;
}

interface WorkoutState {
  todayWorkout: WorkoutPlan | null;
  isLoading: boolean;
  summary: WorkoutSummary | null;
  exerciseHistory: Map<string, ExercisePerformance>;
  personalRecords: Map<string, PersonalRecord>;
  pendingPRCelebration: PRCelebration | null;
  workoutHistory: WorkoutPlan[];
  historyLoading: boolean;

  fetchWorkoutHistory: (userId: string) => Promise<void>;
  fetchTodayWorkout: (userId: string) => Promise<void>;
  fetchExerciseHistory: (userId: string) => Promise<void>;
  fetchPersonalRecords: (userId: string) => Promise<void>;
  checkAndRecordPR: (exercise: Exercise) => void;
  dismissPRCelebration: () => void;
  startWorkout: () => void;
  updateExerciseFeedback: (exerciseId: string, feedback: Exercise['feedback']) => void;
  updateExerciseActuals: (exerciseId: string, actuals: { actualSets?: number; actualReps?: number; actualRepsPerSet?: number[]; actualWeight?: number }) => void;
  setEnergyLevel: (level: 1 | 2 | 3 | 4 | 5) => void;
  setReadiness: (readiness: ReadinessCheck) => void;
  switchToRecovery: () => void;
  applyWorkoutChanges: (changes: WorkoutChange[]) => void;
  swapExercise: (exerciseId: string, newExercise: { name: string; muscleGroup: string; sets: number; reps: number; weight?: number | null; formCues?: string[] }) => void;
  setSessionRPE: (rpe: number) => void;
  completeWorkout: () => Promise<void>;
  skipWorkout: () => Promise<void>;
}

function buildSummary(exercises: Exercise[]): WorkoutSummary {
  return {
    completed: exercises.filter((e) => e.feedback === 'completed').length,
    skipped: exercises.filter((e) => e.feedback === 'skipped').length,
    tooEasy: exercises.filter((e) => e.feedback === 'too-easy').length,
    tooHard: exercises.filter((e) => e.feedback === 'too-hard').length,
    total: exercises.length,
  };
}

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  todayWorkout: null,
  isLoading: false,
  summary: null,
  exerciseHistory: new Map(),
  personalRecords: new Map(),
  pendingPRCelebration: null,
  workoutHistory: [],
  historyLoading: false,

  fetchWorkoutHistory: async (userId) => {
    if (MOCK_MODE) return;
    set({ historyLoading: true });
    try {
      const history = await getWorkoutHistory(userId, 50, 0);
      set({ workoutHistory: history });
    } catch (e) {
      console.error('[workoutStore] fetchWorkoutHistory error:', e);
    } finally {
      set({ historyLoading: false });
    }
  },

  fetchPersonalRecords: async (userId) => {
    if (MOCK_MODE) return;
    try {
      const records = await getPersonalRecords(userId);
      set({ personalRecords: records });
    } catch (e) {
      console.error('[workoutStore] fetchPersonalRecords error:', e);
    }
  },

  checkAndRecordPR: (exercise) => {
    const weight = exercise.actualWeight ?? exercise.weight;
    const reps = exercise.actualReps ?? exercise.reps;
    if (!weight || weight <= 0) return; // Skip bodyweight exercises

    const records = get().personalRecords;
    const existing = records.get(exercise.name);
    const today = new Date().toISOString().split('T')[0];

    // Check if this is a new PR
    const isNewPR = !existing
      || weight > existing.weightKg
      || (weight === existing.weightKg && reps > existing.reps);

    if (!isNewPR) return;

    // Optimistic update
    const newRecord: PersonalRecord = { exerciseName: exercise.name, weightKg: weight, reps, date: today };
    const updatedRecords = new Map(records);
    updatedRecords.set(exercise.name, newRecord);

    set({
      personalRecords: updatedRecords,
      pendingPRCelebration: {
        exerciseName: exercise.name,
        newWeight: weight,
        newReps: reps,
        previousWeight: existing?.weightKg,
        previousReps: existing?.reps,
      },
    });

    // Persist in background
    const userId = useAuthStore.getState().user?.id;
    if (userId && !MOCK_MODE) {
      upsertPersonalRecord(userId, exercise.name, weight, reps, today).catch((e) =>
        console.error('[workoutStore] upsertPersonalRecord error:', e),
      );
    }
  },

  dismissPRCelebration: () => {
    set({ pendingPRCelebration: null });
  },

  fetchExerciseHistory: async (userId) => {
    if (MOCK_MODE) return;
    try {
      const history = await getRecentExerciseHistory(userId);
      set({ exerciseHistory: history });
    } catch (e) {
      console.error('[workoutStore] fetchExerciseHistory error:', e);
    }
  },

  fetchTodayWorkout: async (userId) => {
    if (MOCK_MODE) return;
    set({ isLoading: true });
    try {
      const today = new Date().toISOString().split('T')[0];
      const workout = await getTodayWorkout(userId, today);
      set({ todayWorkout: workout ?? null });
    } catch (e) {
      console.error('[workoutStore] fetchTodayWorkout error:', e);
    } finally {
      set({ isLoading: false });
    }
  },

  startWorkout: () => {
    const workout = get().todayWorkout;
    if (!workout || workout.status !== 'pending') return;

    const startedAt = workout.workoutStartedAt ?? new Date().toISOString();

    // Optimistic update
    set({ todayWorkout: { ...workout, status: 'in-progress', workoutStartedAt: startedAt } });

    // Persist in background
    const userId = useAuthStore.getState().user?.id;
    if (userId && !MOCK_MODE) {
      updateWorkoutStatus(workout.id, 'in-progress').catch((e) =>
        console.error('[workoutStore] startWorkout persist error:', e),
      );
    }
  },

  updateExerciseFeedback: (exerciseId, feedback) => {
    // Use functional set to always read latest state (prevents race conditions)
    set((state) => {
      const workout = state.todayWorkout;
      if (!workout) return state;
      const exercises = workout.exercises.map((ex) =>
        ex.id === exerciseId ? { ...ex, feedback } : ex,
      );
      return { todayWorkout: { ...workout, exercises } };
    });

    // Persist latest state in background
    const updated = get().todayWorkout;
    const userId = useAuthStore.getState().user?.id;
    if (userId && updated && !MOCK_MODE) {
      dbUpdateExerciseFeedback(updated.id, updated.exercises).catch((e) =>
        console.error('[workoutStore] updateExerciseFeedback persist error:', e),
      );
    }

    // Check for personal record on completion
    if (feedback === 'completed' || feedback === 'too-easy') {
      const exercise = updated?.exercises.find((ex) => ex.id === exerciseId);
      if (exercise) {
        get().checkAndRecordPR(exercise);
      }
    }
  },

  updateExerciseActuals: (exerciseId, actuals) => {
    set((state) => {
      const workout = state.todayWorkout;
      if (!workout) return state;
      const exercises = workout.exercises.map((ex) =>
        ex.id === exerciseId ? { ...ex, ...actuals } : ex,
      );
      return { todayWorkout: { ...workout, exercises } };
    });

    const updated = get().todayWorkout;
    const userId = useAuthStore.getState().user?.id;
    if (userId && updated && !MOCK_MODE) {
      dbUpdateExerciseFeedback(updated.id, updated.exercises).catch((e) =>
        console.error('[workoutStore] updateExerciseActuals persist error:', e),
      );
    }
  },

  setEnergyLevel: (level) => {
    const workout = get().todayWorkout;
    if (!workout) return;

    const updated = { ...workout, energyLevel: level };
    set({ todayWorkout: updated });

    if (!MOCK_MODE) {
      supabase
        .from('workout_plans')
        .update({ energy_level: level })
        .eq('id', workout.id)
        .then(({ error }) => {
          if (error) console.error('[workoutStore] setEnergyLevel persist error:', error);
        });
    }
  },

  setReadiness: (readiness) => {
    const workout = get().todayWorkout;
    if (!workout) return;

    const updated = { ...workout, readiness, energyLevel: readiness.energyLevel };
    set({ todayWorkout: updated });

    if (!MOCK_MODE) {
      supabase
        .from('workout_plans')
        .update({ readiness, energy_level: readiness.energyLevel })
        .eq('id', workout.id)
        .then(({ error }) => {
          if (error) console.error('[workoutStore] setReadiness persist error:', error);
        });
    }
  },

  switchToRecovery: () => {
    const workout = get().todayWorkout;
    if (!workout) return;

    // Reduce volume: halve sets (min 1), reduce reps by ~30%
    const exercises = workout.exercises.map((ex) => ({
      ...ex,
      sets: Math.max(1, Math.round(ex.sets * 0.5)),
      reps: Math.max(1, Math.round(ex.reps * 0.7)),
    }));

    const updated = {
      ...workout,
      exercises,
      aiNotes: 'Recovery mode — lighter session to match your energy. Focus on form, not intensity.',
    };
    set({ todayWorkout: updated });

    // Persist in background
    const userId = useAuthStore.getState().user?.id;
    if (userId && !MOCK_MODE) {
      dbUpdateExerciseFeedback(workout.id, exercises).catch((e) =>
        console.error('[workoutStore] switchToRecovery persist error:', e),
      );
    }
  },

  applyWorkoutChanges: (changes) => {
    const workout = get().todayWorkout;
    if (!workout || changes.length === 0) return;

    const exercises = workout.exercises.map((ex) => {
      const change = changes.find(
        (c) => c.exerciseName.toLowerCase() === ex.name.toLowerCase(),
      );
      if (!change) return ex;
      return {
        ...ex,
        ...(change.sets !== undefined && { sets: change.sets }),
        ...(change.reps !== undefined && { reps: change.reps }),
        ...(change.restSeconds !== undefined && { restSeconds: change.restSeconds }),
        ...(change.weight !== undefined && { weight: change.weight }),
      };
    });

    const updated = { ...workout, exercises };
    set({ todayWorkout: updated });

    // Persist in background
    const userId = useAuthStore.getState().user?.id;
    if (userId && !MOCK_MODE) {
      dbUpdateExerciseFeedback(workout.id, exercises).catch((e) =>
        console.error('[workoutStore] applyWorkoutChanges persist error:', e),
      );
    }
  },

  swapExercise: (exerciseId, newExercise) => {
    const workout = get().todayWorkout;
    if (!workout) return;

    const exercises = workout.exercises.map((ex) =>
      ex.id === exerciseId
        ? {
            ...ex,
            name: newExercise.name,
            muscleGroup: newExercise.muscleGroup,
            sets: newExercise.sets,
            reps: newExercise.reps,
            weight: newExercise.weight ?? undefined,
            formCues: newExercise.formCues ?? [],
            feedback: null,
            notes: `Swapped from: ${ex.name}`,
          }
        : ex,
    );

    const updated = { ...workout, exercises };
    set({ todayWorkout: updated });

    // Persist in background
    const userId = useAuthStore.getState().user?.id;
    if (userId && !MOCK_MODE) {
      dbUpdateExerciseFeedback(workout.id, exercises).catch((e) =>
        console.error('[workoutStore] swapExercise persist error:', e),
      );
    }
  },

  setSessionRPE: (rpe) => {
    const workout = get().todayWorkout;
    if (!workout) return;

    set({ todayWorkout: { ...workout, sessionRPE: rpe } });

    if (!MOCK_MODE) {
      supabase
        .from('workout_plans')
        .update({ session_rpe: rpe })
        .eq('id', workout.id)
        .then(({ error }) => {
          if (error) console.error('[workoutStore] setSessionRPE persist error:', error);
        });
    }
  },

  completeWorkout: async () => {
    const workout = get().todayWorkout;
    if (!workout) return;

    const summary = buildSummary(workout.exercises);

    // Optimistic update
    set({
      todayWorkout: { ...workout, status: 'completed' },
      summary,
    });

    // Persist in background
    const userId = useAuthStore.getState().user?.id;
    if (userId && !MOCK_MODE) {
      updateWorkoutStatus(workout.id, 'completed', summary as unknown as Record<string, unknown>).catch(
        (e) => console.error('[workoutStore] completeWorkout persist error:', e),
      );
    }
  },

  skipWorkout: async () => {
    const workout = get().todayWorkout;
    if (!workout) return;

    // Optimistic update
    set({
      todayWorkout: { ...workout, status: 'skipped' },
      summary: null,
    });

    // Persist in background
    const userId = useAuthStore.getState().user?.id;
    if (userId && !MOCK_MODE) {
      updateWorkoutStatus(workout.id, 'skipped').catch((e) =>
        console.error('[workoutStore] skipWorkout persist error:', e),
      );
    }
  },
}));
