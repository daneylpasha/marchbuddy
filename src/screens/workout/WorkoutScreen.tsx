import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useWorkoutStore } from '../../store/workoutStore';
import { useAuthStore } from '../../store/authStore';
import ExerciseCard from '../../components/workout/ExerciseCard';
import RestDayCard from '../../components/workout/RestDayCard';
import WorkoutSummary from '../../components/workout/WorkoutSummary';
import WarmUpCoolDownCard from '../../components/workout/WarmUpCoolDownCard';
import EnergyCheckModal from '../../components/workout/EnergyCheckModal';
import RPEPickerModal from '../../components/workout/RPEPickerModal';
import PRCelebrationModal from '../../components/workout/PRCelebrationModal';
import WorkoutInsights from '../../components/workout/WorkoutInsights';
import ActiveWorkoutFlow from '../../components/workout/ActiveWorkoutFlow';
import ExerciseSwapSheet from '../../components/workout/ExerciseSwapSheet';
import LoadingScreen from '../../components/common/LoadingScreen';
import BebasText from '../../components/common/BebasText';
import { suggestExerciseSwap } from '../../services/aiService';
import type { SwapAlternative } from '../../services/aiService';
import { useProfileStore } from '../../store/profileStore';
import type { Exercise, ReadinessCheck, WorkoutPlan } from '../../types';
import { colors, spacing, fonts } from '../../theme';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function getStatusColor(status: WorkoutPlan['status']): string {
  switch (status) {
    case 'completed': return colors.success;
    case 'in-progress': return colors.warning;
    case 'skipped': return colors.textSecondary;
    default: return colors.primary;
  }
}

function getStatusLabel(status: WorkoutPlan['status']): string {
  switch (status) {
    case 'in-progress': return 'In Progress';
    default: return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

function estimateDuration(workout: WorkoutPlan): number {
  return Math.round(workout.exercises.length * 3.5);
}

function getMuscleGroups(workout: WorkoutPlan): string[] {
  return [...new Set(workout.exercises.map((e) => e.muscleGroup))];
}

const MUSCLE_COLORS: Record<string, string> = {
  Legs: colors.muscleLegs,
  Chest: colors.muscleChest,
  Back: colors.muscleBack,
  Shoulders: colors.muscleShoulders,
  Core: colors.muscleCore,
  Arms: colors.muscleArms,
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function WorkoutScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const {
    todayWorkout,
    isLoading,
    summary,
    exerciseHistory,
    fetchTodayWorkout,
    fetchExerciseHistory,
    startWorkout,
    updateExerciseFeedback,
    updateExerciseActuals,
    setEnergyLevel,
    setReadiness,
    switchToRecovery,
    setSessionRPE,
    personalRecords,
    pendingPRCelebration,
    fetchPersonalRecords,
    dismissPRCelebration,
    swapExercise,
    completeWorkout,
    skipWorkout,
  } = useWorkoutStore();

  const profile = useProfileStore((s) => s.profile);
  const [showEnergyCheck, setShowEnergyCheck] = useState(false);
  const [showRPEPicker, setShowRPEPicker] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'flow'>('flow');
  const [elapsedMin, setElapsedMin] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Swap state
  const [swapTargetId, setSwapTargetId] = useState<string | null>(null);
  const [swapAlternatives, setSwapAlternatives] = useState<SwapAlternative[]>([]);
  const [swapLoading, setSwapLoading] = useState(false);

  // Elapsed time tracker for in-progress workouts
  useEffect(() => {
    if (todayWorkout?.status === 'in-progress' && todayWorkout.workoutStartedAt) {
      const update = () => {
        const diff = Date.now() - new Date(todayWorkout.workoutStartedAt!).getTime();
        setElapsedMin(Math.floor(diff / 60000));
      };
      update();
      timerRef.current = setInterval(update, 30000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    } else {
      setElapsedMin(0);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [todayWorkout?.status, todayWorkout?.workoutStartedAt]);

  useEffect(() => {
    if (!todayWorkout && user) {
      fetchTodayWorkout(user.id);
    }
  }, [todayWorkout, user, fetchTodayWorkout]);

  useEffect(() => {
    if (user) {
      fetchExerciseHistory(user.id);
      fetchPersonalRecords(user.id);
    }
  }, [user, fetchExerciseHistory, fetchPersonalRecords]);

  const handleFeedback = useCallback((exerciseId: string, feedback: Exercise['feedback']) => {
    updateExerciseFeedback(exerciseId, feedback);
  }, [updateExerciseFeedback]);

  const handleActualsChange = useCallback((exerciseId: string, actuals: { actualSets?: number; actualReps?: number; actualWeight?: number }) => {
    updateExerciseActuals(exerciseId, actuals);
  }, [updateExerciseActuals]);

  const handleStartWorkout = useCallback(() => {
    const workout = todayWorkout;
    if (!workout) return;
    if (!workout.energyLevel) {
      setShowEnergyCheck(true);
    } else {
      startWorkout();
    }
  }, [todayWorkout, startWorkout]);

  const handleReadinessSelect = useCallback((readiness: ReadinessCheck) => {
    setReadiness(readiness);
    setShowEnergyCheck(false);
    if (readiness.energyLevel > 2) {
      startWorkout();
    }
    // levels 1-2: recovery handler starts workout
  }, [setReadiness, startWorkout]);

  const handleEnergyRecovery = useCallback(() => {
    setShowEnergyCheck(false);
    switchToRecovery();
    startWorkout();
  }, [switchToRecovery, startWorkout]);

  const handleEnergyDismiss = useCallback(() => {
    setShowEnergyCheck(false);
    startWorkout();
  }, [startWorkout]);

  const handleSwapRequest = useCallback(async (exerciseId: string) => {
    const exercise = todayWorkout?.exercises.find((e) => e.id === exerciseId);
    if (!exercise) return;

    setSwapTargetId(exerciseId);
    setSwapLoading(true);
    setSwapAlternatives([]);

    try {
      const result = await suggestExerciseSwap(
        exercise.name,
        exercise.muscleGroup,
        profile?.equipmentAvailable ?? ['Bodyweight'],
        todayWorkout?.exercises.map((e) => e.name) ?? [],
      );
      setSwapAlternatives(result.alternatives ?? []);
    } catch (e) {
      console.error('[WorkoutScreen] swap request failed:', e);
      setSwapTargetId(null);
    } finally {
      setSwapLoading(false);
    }
  }, [todayWorkout, profile]);

  const handleSwapSelect = useCallback((alt: SwapAlternative) => {
    if (!swapTargetId) return;
    swapExercise(swapTargetId, {
      name: alt.name,
      muscleGroup: alt.muscleGroup,
      sets: alt.sets,
      reps: alt.reps,
      weight: alt.weight,
      formCues: alt.formCues,
    });
    setSwapTargetId(null);
    setSwapAlternatives([]);
  }, [swapTargetId, swapExercise]);

  if (isLoading || !todayWorkout) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <LoadingScreen message="Loading workout..." />
      </SafeAreaView>
    );
  }

  const workout = todayWorkout;
  const allHaveFeedback = workout.exercises.every((e) => e.feedback !== null);
  const hasAtLeastOneCompleted = workout.exercises.some(
    (e) => e.feedback === 'completed' || e.feedback === 'too-easy',
  );
  const canComplete = allHaveFeedback && hasAtLeastOneCompleted;
  const muscleGroups = getMuscleGroups(workout);

  // ─── Rest day ──────────────────────────────────────────────────────────────

  if (workout.isRestDay) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.headerSection}>
          <BebasText>Today's Workout</BebasText>
          <Text style={styles.date}>{formatDate()}</Text>
        </View>
        <View style={styles.restContainer}>
          <RestDayCard restType={workout.restDayType} aiNotes={workout.aiNotes} />
        </View>
      </SafeAreaView>
    );
  }

  // ─── Completed state ───────────────────────────────────────────────────────

  if (workout.status === 'completed' && summary) {
    // Calculate elapsed time for insights
    const completedElapsed = workout.workoutStartedAt
      ? Math.floor((Date.now() - new Date(workout.workoutStartedAt).getTime()) / 60000)
      : 0;

    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.headerSection}>
          <BebasText>Today's Workout</BebasText>
          <Text style={styles.date}>{formatDate()}</Text>
        </View>
        <ScrollView style={styles.summaryScroll} contentContainerStyle={styles.summaryContent} showsVerticalScrollIndicator={false}>
          <WorkoutSummary
            completed={summary.completed}
            skipped={summary.skipped}
            tooEasy={summary.tooEasy}
            tooHard={summary.tooHard}
            total={summary.total}
          />
          <WorkoutInsights
            elapsedMinutes={completedElapsed > 0 ? Math.min(completedElapsed, 180) : 0}
            sessionRPE={workout.sessionRPE}
            exercisesCompleted={summary.completed + summary.tooEasy}
            tooEasyCount={summary.tooEasy}
            tooHardCount={summary.tooHard}
            streakDays={0}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Skipped state ─────────────────────────────────────────────────────────

  if (workout.status === 'skipped') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.headerSection}>
          <BebasText>Today's Workout</BebasText>
          <Text style={styles.date}>{formatDate()}</Text>
        </View>
        <View style={styles.skippedContainer}>
          <Text style={styles.skippedEmoji}>&#x1F614;</Text>
          <Text style={styles.skippedTitle}>Workout Skipped</Text>
          <Text style={styles.skippedText}>No worries — rest today and come back stronger tomorrow.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Active workout (pending / in-progress) ───────────────────────────────

  const renderHeader = () => (
    <View>
      {/* Status badge */}
      <View style={styles.statusRow}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(workout.status) + '22' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(workout.status) }]}>
            {getStatusLabel(workout.status)}
          </Text>
        </View>
      </View>

      {/* Summary bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Ionicons name="list-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.summaryValue}>{workout.exercises.length} exercises</Text>
        </View>
        <View style={styles.summaryDot} />
        <View style={styles.summaryItem}>
          <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.summaryValue}>
            {workout.status === 'in-progress' && elapsedMin > 0
              ? `${elapsedMin} min elapsed`
              : `~${estimateDuration(workout)} min`}
          </Text>
        </View>
      </View>

      {/* Muscle group chips */}
      <View style={styles.muscleChips}>
        {muscleGroups.map((group) => (
          <View key={group} style={[styles.muscleChip, { backgroundColor: (MUSCLE_COLORS[group] ?? colors.textSecondary) + '22' }]}>
            <Text style={[styles.muscleChipText, { color: MUSCLE_COLORS[group] ?? colors.textSecondary }]}>{group}</Text>
          </View>
        ))}
      </View>

      {/* AI notes */}
      {workout.aiNotes ? (
        <View style={styles.aiNotesBox}>
          <Ionicons name="sparkles" size={14} color={colors.primary} />
          <Text style={styles.aiNotesText}>{workout.aiNotes}</Text>
        </View>
      ) : null}

      {/* Warm-up section */}
      {workout.warmUp && workout.warmUp.length > 0 && (
        <WarmUpCoolDownCard
          title="Warm-Up"
          exercises={workout.warmUp}
          accentColor={colors.warning}
          icon="flame-outline"
        />
      )}

      {/* Exercise list header */}
      <Text style={styles.exercisesHeader}>Exercises</Text>
    </View>
  );

  // Flow view for in-progress workouts
  if (workout.status === 'in-progress' && viewMode === 'flow') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.headerSection}>
          <BebasText>Today's Workout</BebasText>
          <Text style={styles.date}>{formatDate()}</Text>
        </View>

        <ActiveWorkoutFlow
          exercises={workout.exercises}
          onFeedback={handleFeedback}
          onActualsChange={handleActualsChange}
          onSwapRequest={handleSwapRequest}
          personalRecords={personalRecords}
          previousPerformances={exerciseHistory}
          onSwitchToList={() => setViewMode('list')}
        />

        {/* Bottom controls */}
        <View style={[styles.bottomBar, { paddingBottom: 5 }]}>
          <View style={styles.bottomActions}>
            <Pressable
              style={[styles.primaryBtn, !canComplete && styles.primaryBtnDisabled]}
              onPress={() => setShowRPEPicker(true)}
              disabled={!canComplete}
              accessibilityRole="button"
              accessibilityLabel="Complete workout"
            >
              <Ionicons name="checkmark-done" size={20} color="#fff" />
              <Text style={styles.primaryBtnText}>COMPLETE WORKOUT</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={skipWorkout} accessibilityRole="button" accessibilityLabel="Skip workout">
              <Text style={styles.secondaryBtnText}>Skip Workout</Text>
            </Pressable>
          </View>
        </View>

        {/* PR celebration modal */}
        <PRCelebrationModal
          visible={!!pendingPRCelebration}
          exerciseName={pendingPRCelebration?.exerciseName ?? ''}
          newWeight={pendingPRCelebration?.newWeight ?? 0}
          newReps={pendingPRCelebration?.newReps ?? 0}
          previousWeight={pendingPRCelebration?.previousWeight}
          previousReps={pendingPRCelebration?.previousReps}
          onDismiss={dismissPRCelebration}
        />

        {/* RPE picker modal */}
        <RPEPickerModal
          visible={showRPEPicker}
          onSelect={(rpe) => {
            setShowRPEPicker(false);
            setSessionRPE(rpe);
            completeWorkout();
          }}
          onSkip={() => {
            setShowRPEPicker(false);
            completeWorkout();
          }}
        />

        {/* Exercise swap sheet */}
        <ExerciseSwapSheet
          visible={!!swapTargetId}
          loading={swapLoading}
          exerciseName={workout.exercises.find((e) => e.id === swapTargetId)?.name ?? ''}
          alternatives={swapAlternatives}
          onSelect={handleSwapSelect}
          onDismiss={() => { setSwapTargetId(null); setSwapAlternatives([]); }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.headerSection}>
        <BebasText>Today's Workout</BebasText>
        <Text style={styles.date}>{formatDate()}</Text>
      </View>

      {/* Exercise list */}
      <FlatList
        data={workout.exercises}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <ExerciseCard
            exercise={item}
            onFeedback={handleFeedback}
            onActualsChange={handleActualsChange}
            onSwap={handleSwapRequest}
            previousPerformance={exerciseHistory?.get(item.name) ?? null}
            personalRecord={personalRecords?.get(item.name) ?? null}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={() =>
          workout.coolDown && workout.coolDown.length > 0 ? (
            <WarmUpCoolDownCard
              title="Cool-Down"
              exercises={workout.coolDown}
              accentColor="#26a69a"
              icon="snow-outline"
            />
          ) : null
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Bottom controls */}
      <View style={[styles.bottomBar, { paddingBottom: 5 }]}>
        {workout.status === 'pending' && (
          <Pressable style={styles.primaryBtn} onPress={handleStartWorkout} accessibilityRole="button" accessibilityLabel="Start workout">
            <Ionicons name="play" size={20} color="#fff" />
            <Text style={styles.primaryBtnText}>START WORKOUT</Text>
          </Pressable>
        )}

        {workout.status === 'in-progress' && (
          <View style={styles.bottomActions}>
            <View style={styles.viewToggleRow}>
              <Pressable style={styles.viewToggleBtn} onPress={() => setViewMode('flow')}>
                <Ionicons name="swap-horizontal" size={16} color={colors.primary} />
                <Text style={styles.viewToggleBtnText}>Switch to Flow View</Text>
              </Pressable>
            </View>
            <Pressable
              style={[styles.primaryBtn, !canComplete && styles.primaryBtnDisabled]}
              onPress={() => setShowRPEPicker(true)}
              disabled={!canComplete}
              accessibilityRole="button"
              accessibilityLabel="Complete workout"
            >
              <Ionicons name="checkmark-done" size={20} color="#fff" />
              <Text style={styles.primaryBtnText}>COMPLETE WORKOUT</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={skipWorkout} accessibilityRole="button" accessibilityLabel="Skip workout">
              <Text style={styles.secondaryBtnText}>Skip Workout</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Energy check modal */}
      <EnergyCheckModal
        visible={showEnergyCheck}
        onSelect={handleReadinessSelect}
        onRequestRecovery={handleEnergyRecovery}
        onDismiss={handleEnergyDismiss}
      />

      {/* PR celebration modal */}
      <PRCelebrationModal
        visible={!!pendingPRCelebration}
        exerciseName={pendingPRCelebration?.exerciseName ?? ''}
        newWeight={pendingPRCelebration?.newWeight ?? 0}
        newReps={pendingPRCelebration?.newReps ?? 0}
        previousWeight={pendingPRCelebration?.previousWeight}
        previousReps={pendingPRCelebration?.previousReps}
        onDismiss={dismissPRCelebration}
      />

      {/* RPE picker modal (shown on workout complete) */}
      <RPEPickerModal
        visible={showRPEPicker}
        onSelect={(rpe) => {
          setShowRPEPicker(false);
          setSessionRPE(rpe);
          completeWorkout();
        }}
        onSkip={() => {
          setShowRPEPicker(false);
          completeWorkout();
        }}
      />

      {/* Exercise swap sheet */}
      <ExerciseSwapSheet
        visible={!!swapTargetId}
        loading={swapLoading}
        exerciseName={workout.exercises.find((e) => e.id === swapTargetId)?.name ?? ''}
        alternatives={swapAlternatives}
        onSelect={handleSwapSelect}
        onDismiss={() => { setSwapTargetId(null); setSwapAlternatives([]); }}
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  // Header
  headerSection: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {},
  date: { color: colors.textSecondary, fontSize: 14, marginTop: 3, fontFamily: fonts.regular, letterSpacing: 0.3 },

  // Status
  statusRow: { flexDirection: 'row', marginBottom: 12 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  statusText: { fontSize: 13, fontWeight: '600', textTransform: 'capitalize', fontFamily: fonts.semiBold, letterSpacing: 0.3 },

  // Summary bar
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  summaryItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  summaryValue: { color: colors.textSecondary, fontSize: 14, fontFamily: fonts.regular, letterSpacing: 0.3 },
  summaryDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.textMuted },

  // Muscle chips
  muscleChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  muscleChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, minHeight: 32 },
  muscleChipText: { fontSize: 13, fontWeight: '600', fontFamily: fonts.semiBold, letterSpacing: 0.3 },

  // AI notes
  aiNotesBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.primaryDim,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.2)',
    padding: 14,
    marginBottom: 18,
  },
  aiNotesText: { color: colors.textSecondary, fontSize: 13, flex: 1, lineHeight: 20, fontStyle: 'italic', fontFamily: fonts.regular, letterSpacing: 0.3 },

  // Exercises
  exercisesHeader: { color: colors.textPrimary, fontSize: 17, fontWeight: '600', marginBottom: 12, fontFamily: fonts.semiBold, letterSpacing: 0.3 },
  listContent: { paddingHorizontal: spacing.screenPadding, paddingBottom: 16 },

  // Bottom bar
  bottomBar: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 12,
    paddingBottom: 5,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
    backgroundColor: colors.background,
  },
  bottomActions: { gap: 4 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 17,
    minHeight: 56,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryBtnDisabled: {
    backgroundColor: colors.dotInactive,
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.8, fontFamily: fonts.bold },
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: 8,
    minHeight: 40,
    justifyContent: 'center',
  },
  secondaryBtnText: { color: colors.textSecondary, fontSize: 14, fontFamily: fonts.regular, letterSpacing: 0.3 },
  viewToggleRow: { alignItems: 'center', marginBottom: 8 },
  viewToggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  viewToggleBtnText: { color: colors.primary, fontSize: 13, fontFamily: fonts.medium, letterSpacing: 0.3 },

  // Rest day
  restContainer: { flex: 1, padding: spacing.screenPadding },

  // Summary
  summaryContainer: { flex: 1, padding: spacing.screenPadding, justifyContent: 'center' },
  summaryScroll: { flex: 1 },
  summaryContent: { padding: spacing.screenPadding, paddingBottom: 40 },

  // Skipped
  skippedContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  skippedEmoji: { fontSize: 48, marginBottom: 12 },
  skippedTitle: { color: colors.textPrimary, fontSize: 24, fontWeight: '700', marginBottom: 8, fontFamily: fonts.bold, letterSpacing: 0.3 },
  skippedText: { color: colors.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22, fontFamily: fonts.regular, letterSpacing: 0.3 },
});
