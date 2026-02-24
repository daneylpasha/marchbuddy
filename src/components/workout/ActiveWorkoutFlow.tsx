import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import ProgressRing from '../common/ProgressRing';
import { colors, fonts, spacing } from '../../theme';
import type { Exercise } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - spacing.screenPadding * 2;

interface ActiveWorkoutFlowProps {
  exercises: Exercise[];
  onFeedback: (exerciseId: string, feedback: Exercise['feedback']) => void;
  onActualsChange?: (exerciseId: string, actuals: { actualWeight?: number; actualRepsPerSet?: number[] }) => void;
  onSwapRequest?: (exerciseId: string) => void;
  personalRecords?: Map<string, { weightKg: number; reps: number }>;
  previousPerformances?: Map<string, { weight?: number; reps?: number; date: string }>;
  onSwitchToList: () => void;
}

interface FeedbackOption {
  value: Exercise['feedback'];
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
}

const FEEDBACK_OPTIONS: FeedbackOption[] = [
  { value: 'completed', icon: 'checkmark-circle', label: 'Done', color: colors.success },
  { value: 'skipped', icon: 'play-skip-forward', label: 'Skip', color: colors.textSecondary },
  { value: 'too-easy', icon: 'flash', label: 'Easy', color: colors.warning },
  { value: 'too-hard', icon: 'barbell', label: 'Hard', color: colors.danger },
];

export default function ActiveWorkoutFlow({
  exercises,
  onFeedback,
  onActualsChange,
  onSwapRequest,
  personalRecords,
  previousPerformances,
  onSwitchToList,
}: ActiveWorkoutFlowProps) {
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [restSeconds, setRestSeconds] = useState(0);
  const [totalRestSeconds, setTotalRestSeconds] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const completedCount = exercises.filter((e) => e.feedback !== null).length;

  // Rest timer
  useEffect(() => {
    if (isResting && restSeconds > 0) {
      timerRef.current = setInterval(() => {
        setRestSeconds((prev) => {
          if (prev <= 1) {
            setIsResting(false);
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
            // Haptic notification when timer ends
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isResting]);

  // Auto-advance to next uncompleted exercise after feedback
  const handleFeedback = useCallback((exerciseId: string, feedback: Exercise['feedback']) => {
    onFeedback(exerciseId, feedback);

    // Start rest timer on completion
    const ex = exercises.find((e) => e.id === exerciseId);
    if (ex && (feedback === 'completed' || feedback === 'too-easy') && ex.restSeconds > 0) {
      setRestSeconds(ex.restSeconds);
      setTotalRestSeconds(ex.restSeconds);
      setIsResting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    // Auto-advance to next uncompleted exercise after a brief delay
    setTimeout(() => {
      const nextIdx = exercises.findIndex((e, i) => i > currentIndex && e.feedback === null);
      if (nextIdx >= 0) {
        flatListRef.current?.scrollToIndex({ index: nextIdx, animated: true });
        setCurrentIndex(nextIdx);
      }
    }, 600);
  }, [exercises, currentIndex, onFeedback]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: { index: number | null }[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const renderItem = useCallback(({ item: exercise }: { item: Exercise }) => {
    const pr = personalRecords?.get(exercise.name);
    const prev = previousPerformances?.get(exercise.name);
    const hasFeedback = exercise.feedback !== null;
    const isNearPR = pr && exercise.weight != null && exercise.weight >= pr.weightKg * 0.95;

    return (
      <View style={[styles.card, { width: CARD_WIDTH }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.cardContent}
          nestedScrollEnabled
        >
          {/* Exercise header */}
          <View style={styles.cardHeader}>
            <Text style={styles.orderBadge}>{exercise.order}/{exercises.length}</Text>
            <View style={styles.cardHeaderRight}>
              {isNearPR && (
                <View style={styles.prBadge}>
                  <Ionicons name="trophy" size={12} color="#FFD700" />
                  <Text style={styles.prBadgeText}>Near PR</Text>
                </View>
              )}
              {!hasFeedback && onSwapRequest && (
                <Pressable style={styles.swapBtn} onPress={() => onSwapRequest(exercise.id)}>
                  <Ionicons name="swap-horizontal" size={14} color={colors.primary} />
                </Pressable>
              )}
            </View>
          </View>

          <Text style={styles.exerciseName}>{exercise.name}</Text>
          <Text style={styles.muscleGroup}>{exercise.muscleGroup}</Text>

          {/* Main stats */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{exercise.sets}</Text>
              <Text style={styles.statLabel}>Sets</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{exercise.reps}</Text>
              <Text style={styles.statLabel}>Reps</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{exercise.restSeconds}s</Text>
              <Text style={styles.statLabel}>Rest</Text>
            </View>
            {exercise.weight != null && (
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{exercise.weight}kg</Text>
                <Text style={styles.statLabel}>Weight</Text>
              </View>
            )}
          </View>

          {/* Previous performance */}
          {prev && prev.weight != null && (
            <View style={styles.prevRow}>
              <Ionicons name="time-outline" size={13} color={colors.textTertiary} />
              <Text style={styles.prevText}>
                Last: {prev.weight}kg x {prev.reps} ({prev.date})
              </Text>
            </View>
          )}

          {/* Weight input */}
          {exercise.weight != null && (
            <View style={styles.weightInputRow}>
              <Text style={styles.weightLabel}>Actual weight:</Text>
              <TextInput
                style={styles.weightInput}
                keyboardType="numeric"
                placeholder={String(exercise.weight)}
                placeholderTextColor={colors.textMuted}
                value={exercise.actualWeight != null ? String(exercise.actualWeight) : ''}
                onChangeText={(text) => {
                  const val = parseFloat(text);
                  if (!isNaN(val) && val > 0) {
                    onActualsChange?.(exercise.id, { actualWeight: val });
                  } else if (text === '') {
                    onActualsChange?.(exercise.id, { actualWeight: undefined });
                  }
                }}
              />
              <Text style={styles.weightUnit}>kg</Text>
            </View>
          )}

          {/* Form cues */}
          {exercise.formCues && exercise.formCues.length > 0 && (
            <View style={styles.cuesBox}>
              {exercise.formCues.map((cue, i) => (
                <Text key={i} style={styles.cueText}>{'\u2022'} {cue}</Text>
              ))}
            </View>
          )}

          {/* Feedback buttons */}
          <View style={styles.feedbackRow}>
            {FEEDBACK_OPTIONS.map((opt) => {
              const isSelected = exercise.feedback === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  style={[
                    styles.feedbackBtn,
                    isSelected && { backgroundColor: opt.color + '22', borderColor: opt.color },
                  ]}
                  onPress={() => handleFeedback(exercise.id, opt.value)}
                >
                  <Ionicons
                    name={opt.icon}
                    size={20}
                    color={isSelected ? opt.color : colors.textSecondary}
                  />
                  <Text style={[styles.feedbackLabel, isSelected && { color: opt.color }]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {hasFeedback && (
            <View style={styles.doneOverlay}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.doneText}>Logged</Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }, [exercises, personalRecords, previousPerformances, handleFeedback, onActualsChange]);

  return (
    <View style={styles.container}>
      {/* Top bar: progress ring + list toggle */}
      <View style={styles.topBar}>
        <ProgressRing
          current={completedCount}
          total={exercises.length}
          size={64}
          strokeWidth={5}
          color={colors.success}
          label={`/${exercises.length}`}
        />
        <View style={styles.topBarCenter}>
          <Text style={styles.progressText}>{completedCount} of {exercises.length} done</Text>
          <Text style={styles.progressPercent}>
            {exercises.length > 0 ? Math.round((completedCount / exercises.length) * 100) : 0}%
          </Text>
        </View>
        <Pressable style={styles.listToggle} onPress={onSwitchToList}>
          <Ionicons name="list" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Rest timer overlay with ProgressRing */}
      {isResting && (
        <View style={styles.restOverlay}>
          <ProgressRing
            current={totalRestSeconds - restSeconds}
            total={totalRestSeconds}
            size={100}
            strokeWidth={6}
            color={colors.primary}
            label="s"
            customCenter={
              <Text style={styles.restRingText}>{restSeconds}</Text>
            }
          />
          <Text style={styles.restLabel}>Rest Time</Text>
          <Pressable style={styles.skipRestBtn} onPress={() => { setIsResting(false); setRestSeconds(0); }}>
            <Text style={styles.skipRestText}>Skip Rest</Text>
          </Pressable>
        </View>
      )}

      {/* Swipeable exercise cards */}
      <FlatList
        ref={flatListRef}
        data={exercises}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + 12}
        decelerationRate="fast"
        style={styles.cardList}
        contentContainerStyle={styles.listContent}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        keyboardShouldPersistTaps="handled"
        getItemLayout={(_, index) => ({
          length: CARD_WIDTH + 12,
          offset: (CARD_WIDTH + 12) * index,
          index,
        })}
      />

      {/* Progress dots */}
      <View style={styles.dotsRow}>
        {exercises.map((ex, i) => (
          <View
            key={ex.id}
            style={[
              styles.dot,
              i === currentIndex && styles.dotCurrent,
              ex.feedback !== null && styles.dotComplete,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 10,
    gap: 14,
  },
  topBarCenter: {
    flex: 1,
  },
  progressText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    letterSpacing: 0.3,
  },
  progressPercent: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    letterSpacing: 0.3,
    marginTop: 2,
  },
  listToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  restOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,212,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.2)',
    borderRadius: 16,
    paddingVertical: 20,
    marginHorizontal: spacing.screenPadding,
    marginBottom: 8,
  },
  restRingText: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: '700',
    fontFamily: fonts.bold,
    fontVariant: ['tabular-nums'],
  },
  restLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: fonts.medium,
    letterSpacing: 0.3,
  },
  skipRestBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: colors.background,
  },
  skipRestText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    fontFamily: fonts.medium,
    letterSpacing: 0.3,
  },
  cardList: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.screenPadding,
    gap: 12,
  },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 18,
    padding: 20,
    flex: 1,
  },
  cardContent: {
    flexGrow: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  swapBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderBadge: {
    color: colors.textTertiary,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    letterSpacing: 0.3,
  },
  prBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  prBadgeText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
  },
  exerciseName: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    fontFamily: fonts.bold,
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  muscleGroup: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: fonts.medium,
    letterSpacing: 0.3,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingVertical: 12,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    fontFamily: fonts.bold,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: colors.textTertiary,
    fontSize: 11,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
    marginTop: 2,
  },
  prevRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  prevText: {
    color: colors.textTertiary,
    fontSize: 12,
    fontStyle: 'italic',
    fontFamily: fonts.regular,
  },
  weightInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  weightLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: fonts.medium,
  },
  weightInput: {
    backgroundColor: colors.surfaceElevated,
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: fonts.bold,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 60,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.dotInactive,
  },
  weightUnit: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: fonts.regular,
  },
  cuesBox: {
    backgroundColor: 'rgba(255,152,0,0.08)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  cueText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: fonts.regular,
    lineHeight: 18,
  },
  feedbackRow: {
    flexDirection: 'row',
    gap: 8,
  },
  feedbackBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: 'transparent',
    minHeight: 52,
  },
  feedbackLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '500',
    fontFamily: fonts.medium,
  },
  doneOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  doneText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 12,
    paddingBottom: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.dotInactive,
  },
  dotCurrent: {
    backgroundColor: colors.primary,
    width: 20,
    borderRadius: 4,
  },
  dotComplete: {
    backgroundColor: colors.success,
  },
});
