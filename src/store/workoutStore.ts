import { create } from 'zustand';
import type { Exercise, ReadinessCheck, WorkoutPlan } from '../types';
import type { WorkoutChange } from '../services/aiService';
import { useAuthStore } from './authStore';
import { useNetworkStore } from './networkStore';
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
import { offlineCache, CACHE_KEYS } from '../services/offlineCache';
import { offlineQueue } from '../services/offlineQueue';

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

function cacheWorkout(workout: WorkoutPlan | null) {
  if (workout) {
    offlineCache.set(CACHE_KEYS.TODAY_WORKOUT, workout, workout.userId);
  }
}

function persistOrQueue(action: string, args: unknown[], fn: () => Promise<unknown>) {
  const isConnected = useNetworkStore.getState().isConnected;
  if (isConnected) {
    fn().catch((e) => console.error(`[workoutStore] ${action} persist error:`, e));
  } else {
    offlineQueue.enqueue(action, args);
  }
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
      const isConnected = useNetworkStore.getState().isConnected;
      if (isConnected) {
        const history = await getWorkoutHistory(userId, 50, 0);
        set({ workoutHistory: history });
        offlineCache.set(CACHE_KEYS.WORKOUT_HISTORY, history, userId);
      } else {
        const cached = await offlineCache.get<WorkoutPlan[]>(CACHE_KEYS.WORKOUT_HISTORY, userId);
        if (cached) set({ workoutHistory: cached });
      }
    } catch (e) {
      console.error('[workoutStore] fetchWorkoutHistory error:', e);
      const cached = await offlineCache.get<WorkoutPlan[]>(CACHE_KEYS.WORKOUT_HISTORY, userId);
      if (cached) set({ workoutHistory: cached });
    } finally {
      set({ historyLoading: false });
    }
  },

  fetchPersonalRecords: async (userId) => {
    if (MOCK_MODE) return;
    try {
      const isConnected = useNetworkStore.getState().isConnected;
      if (isConnected) {
        const records = await getPersonalRecords(userId);
        set({ personalRecords: records });
        // Cache as serializable array
        offlineCache.set(CACHE_KEYS.PERSONAL_RECORDS, Array.from(records.entries()), userId);
      } else {
        const cached = await offlineCache.get<[string, PersonalRecord][]>(CACHE_KEYS.PERSONAL_RECORDS, userId);
        if (cached) set({ personalRecords: new Map(cached) });
      }
    } catch (e) {
      console.error('[workoutStore] fetchPersonalRecords error:', e);
      const cached = await offlineCache.get<[string, PersonalRecord][]>(CACHE_KEYS.PERSONAL_RECORDS, userId);
      if (cached) set({ personalRecords: new Map(cached) });
    }
  },

  checkAndRecordPR: (exercise) => {
    const weight = exercise.actualWeight ?? exercise.weight;
    const reps = exercise.actualReps ?? exercise.reps;
    if (!weight || weight <= 0) return;

    const records = get().personalRecords;
    const existing = records.get(exercise.name);
    const today = new Date().toISOString().split('T')[0];

    const isNewPR = !existing
      || weight > existing.weightKg
      || (weight === existing.weightKg && reps > existing.reps);

    if (!isNewPR) return;

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

    // Cache updated records
    const userId = useAuthStore.getState().user?.id;
    if (userId) {
      offlineCache.set(CACHE_KEYS.PERSONAL_RECORDS, Array.from(updatedRecords.entries()), userId);
    }

    if (userId && !MOCK_MODE) {
      persistOrQueue('upsertPersonalRecord', [userId, exercise.name, weight, reps, today], () =>
        upsertPersonalRecord(userId, exercise.name, weight, reps, today),
      );
    }
  },

  dismissPRCelebration: () => {
    set({ pendingPRCelebration: null });
  },

  fetchExerciseHistory: async (userId) => {
    if (MOCK_MODE) return;
    try {
      const isConnected = useNetworkStore.getState().isConnected;
      if (isConnected) {
        const history = await getRecentExerciseHistory(userId);
        set({ exerciseHistory: history });
        offlineCache.set(CACHE_KEYS.EXERCISE_HISTORY, Array.from(history.entries()), userId);
      } else {
        const cached = await offlineCache.get<[string, ExercisePerformance][]>(CACHE_KEYS.EXERCISE_HISTORY, userId);
        if (cached) set({ exerciseHistory: new Map(cached) });
      }
    } catch (e) {
      console.error('[workoutStore] fetchExerciseHistory error:', e);
      const cached = await offlineCache.get<[string, ExercisePerformance][]>(CACHE_KEYS.EXERCISE_HISTORY, userId);
      if (cached) set({ exerciseHistory: new Map(cached) });
    }
  },

  fetchTodayWorkout: async (userId) => {
    if (MOCK_MODE) return;
    set({ isLoading: true });
    try {
      const today = new Date().toISOString().split('T')[0];
      const isConnected = useNetworkStore.getState().isConnected;

      if (isConnected) {
        const workout = await getTodayWorkout(userId, today);
        set({ todayWorkout: workout ?? null });
        if (workout) {
          offlineCache.set(CACHE_KEYS.TODAY_WORKOUT, workout, userId);
        }
      } else {
        const cached = await offlineCache.get<WorkoutPlan>(CACHE_KEYS.TODAY_WORKOUT, userId);
        if (cached && cached.date === today) {
          set({ todayWorkout: cached });
        }
      }
    } catch (e) {
      console.error('[workoutStore] fetchTodayWorkout error:', e);
      const today = new Date().toISOString().split('T')[0];
      const cached = await offlineCache.get<WorkoutPlan>(CACHE_KEYS.TODAY_WORKOUT, userId);
      if (cached && cached.date === today) {
        set({ todayWorkout: cached });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  startWorkout: () => {
    const workout = get().todayWorkout;
    if (!workout || workout.status !== 'pending') return;

    const startedAt = workout.workoutStartedAt ?? new Date().toISOString();
    const updated = { ...workout, status: 'in-progress' as const, workoutStartedAt: startedAt };
    set({ todayWorkout: updated });
    cacheWorkout(updated);

    const userId = useAuthStore.getState().user?.id;
    if (userId && !MOCK_MODE) {
      persistOrQueue('updateWorkoutStatus', [workout.id, 'in-progress'], () =>
        updateWorkoutStatus(workout.id, 'in-progress'),
      );
    }
  },

  updateExerciseFeedback: (exerciseId, feedback) => {
    set((state) => {
      const workout = state.todayWorkout;
      if (!workout) return state;
      const exercises = workout.exercises.map((ex) =>
        ex.id === exerciseId ? { ...ex, feedback } : ex,
      );
      const updated = { ...workout, exercises };
      cacheWorkout(updated);
      return { todayWorkout: updated };
    });

    const updated = get().todayWorkout;
    const userId = useAuthStore.getState().user?.id;
    if (userId && updated && !MOCK_MODE) {
      persistOrQueue('updateExerciseFeedback', [updated.id, updated.exercises], () =>
        dbUpdateExerciseFeedback(updated.id, updated.exercises),
      );
    }

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
      const updated = { ...workout, exercises };
      cacheWorkout(updated);
      return { todayWorkout: updated };
    });

    const updated = get().todayWorkout;
    const userId = useAuthStore.getState().user?.id;
    if (userId && updated && !MOCK_MODE) {
      persistOrQueue('updateExerciseFeedback', [updated.id, updated.exercises], () =>
        dbUpdateExerciseFeedback(updated.id, updated.exercises),
      );
    }
  },

  setEnergyLevel: (level) => {
    const workout = get().todayWorkout;
    if (!workout) return;

    const updated = { ...workout, energyLevel: level };
    set({ todayWorkout: updated });
    cacheWorkout(updated);

    if (!MOCK_MODE) {
      persistOrQueue('updateWorkoutColumn', [workout.id, 'energy_level', level], async () => {
        const { error } = await supabase
          .from('workout_plans')
          .update({ energy_level: level })
          .eq('id', workout.id);
        if (error) throw error;
      });
    }
  },

  setReadiness: (readiness) => {
    const workout = get().todayWorkout;
    if (!workout) return;

    const updated = { ...workout, readiness, energyLevel: readiness.energyLevel };
    set({ todayWorkout: updated });
    cacheWorkout(updated);

    if (!MOCK_MODE) {
      persistOrQueue('updateWorkoutColumns', [workout.id, { readiness, energy_level: readiness.energyLevel }], async () => {
        const { error } = await supabase
          .from('workout_plans')
          .update({ readiness, energy_level: readiness.energyLevel })
          .eq('id', workout.id);
        if (error) throw error;
      });
    }
  },

  switchToRecovery: () => {
    const workout = get().todayWorkout;
    if (!workout) return;

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
    cacheWorkout(updated);

    const userId = useAuthStore.getState().user?.id;
    if (userId && !MOCK_MODE) {
      persistOrQueue('updateExerciseFeedback', [workout.id, exercises], () =>
        dbUpdateExerciseFeedback(workout.id, exercises),
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
    cacheWorkout(updated);

    const userId = useAuthStore.getState().user?.id;
    if (userId && !MOCK_MODE) {
      persistOrQueue('updateExerciseFeedback', [workout.id, exercises], () =>
        dbUpdateExerciseFeedback(workout.id, exercises),
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
    cacheWorkout(updated);

    const userId = useAuthStore.getState().user?.id;
    if (userId && !MOCK_MODE) {
      persistOrQueue('updateExerciseFeedback', [workout.id, exercises], () =>
        dbUpdateExerciseFeedback(workout.id, exercises),
      );
    }
  },

  setSessionRPE: (rpe) => {
    const workout = get().todayWorkout;
    if (!workout) return;

    const updated = { ...workout, sessionRPE: rpe };
    set({ todayWorkout: updated });
    cacheWorkout(updated);

    if (!MOCK_MODE) {
      persistOrQueue('updateWorkoutColumn', [workout.id, 'session_rpe', rpe], async () => {
        const { error } = await supabase
          .from('workout_plans')
          .update({ session_rpe: rpe })
          .eq('id', workout.id);
        if (error) throw error;
      });
    }
  },

  completeWorkout: async () => {
    const workout = get().todayWorkout;
    if (!workout) return;

    const summary = buildSummary(workout.exercises);
    const updated = { ...workout, status: 'completed' as const };
    set({ todayWorkout: updated, summary });
    cacheWorkout(updated);

    const userId = useAuthStore.getState().user?.id;
    if (userId && !MOCK_MODE) {
      persistOrQueue('updateWorkoutStatus', [workout.id, 'completed', summary], () =>
        updateWorkoutStatus(workout.id, 'completed', summary as unknown as Record<string, unknown>),
      );
    }
  },

  skipWorkout: async () => {
    const workout = get().todayWorkout;
    if (!workout) return;

    const updated = { ...workout, status: 'skipped' as const };
    set({ todayWorkout: updated, summary: null });
    cacheWorkout(updated);

    const userId = useAuthStore.getState().user?.id;
    if (userId && !MOCK_MODE) {
      persistOrQueue('updateWorkoutStatus', [workout.id, 'skipped'], () =>
        updateWorkoutStatus(workout.id, 'skipped'),
      );
    }
  },
}));
