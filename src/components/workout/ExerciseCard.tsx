import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, TextInput, UIManager, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../theme';
import type { Exercise } from '../../types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface ExerciseCardProps {
  exercise: Exercise;
  onFeedback: (exerciseId: string, feedback: Exercise['feedback']) => void;
  onActualsChange?: (exerciseId: string, actuals: { actualSets?: number; actualReps?: number; actualRepsPerSet?: number[]; actualWeight?: number }) => void;
  onSwap?: (exerciseId: string) => void;
  previousPerformance?: { weight?: number; reps?: number; sets?: number; date: string } | null;
  personalRecord?: { weightKg: number; reps: number } | null;
}

const MUSCLE_COLORS: Record<string, string> = {
  Legs: colors.muscleLegs,
  Chest: colors.muscleChest,
  Back: colors.muscleBack,
  Shoulders: colors.muscleShoulders,
  Core: colors.muscleCore,
  Arms: colors.muscleArms,
};

interface FeedbackOption {
  value: Exercise['feedback'];
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}

const FEEDBACK_OPTIONS: FeedbackOption[] = [
  { value: 'completed', icon: 'checkmark-circle', label: 'Done' },
  { value: 'skipped', icon: 'play-skip-forward', label: 'Skip' },
  { value: 'too-easy', icon: 'flash', label: 'Easy' },
  { value: 'too-hard', icon: 'barbell', label: 'Hard' },
];

export default function ExerciseCard({ exercise, onFeedback, onActualsChange, onSwap, previousPerformance, personalRecord }: ExerciseCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [restSeconds, setRestSeconds] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const muscleColor = MUSCLE_COLORS[exercise.muscleGroup] ?? colors.textSecondary;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };

  const startRestTimer = useCallback(() => {
    setRestSeconds(exercise.restSeconds);
    setIsResting(true);
  }, [exercise.restSeconds]);

  const stopRestTimer = useCallback(() => {
    setIsResting(false);
    setRestSeconds(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => {
    if (isResting && restSeconds > 0) {
      timerRef.current = setInterval(() => {
        setRestSeconds((prev) => {
          if (prev <= 1) {
            setIsResting(false);
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
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

  const hasFeedback = exercise.feedback !== null;

  return (
    <Pressable style={[styles.card, hasFeedback && styles.cardDone]} onPress={toggle}>
      {/* Collapsed row */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.orderNum}>{exercise.order}</Text>
          <View style={styles.headerInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={2}>{exercise.name}</Text>
              {personalRecord && exercise.weight != null && exercise.weight >= personalRecord.weightKg * 0.95 && (
                <View style={styles.prBadge}>
                  <Ionicons name="trophy" size={10} color="#FFD700" />
                  <Text style={styles.prBadgeText}>PR</Text>
                </View>
              )}
            </View>
            <View style={styles.metaRow}>
              <View style={[styles.muscleChip, { backgroundColor: muscleColor + '22' }]}>
                <Text style={[styles.muscleText, { color: muscleColor }]}>{exercise.muscleGroup}</Text>
              </View>
              <Text style={styles.setsReps}>{exercise.sets} × {exercise.reps}</Text>
            </View>
          </View>
        </View>
        <View style={styles.headerRight}>
          {!hasFeedback && onSwap && (
            <Pressable
              style={styles.swapBtn}
              onPress={(e) => { e.stopPropagation(); onSwap(exercise.id); }}
              hitSlop={8}
            >
              <Ionicons name="swap-horizontal" size={16} color={colors.primary} />
            </Pressable>
          )}
          {hasFeedback && (
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          )}
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.textTertiary}
          />
        </View>
      </View>

      {/* Expanded details */}
      {expanded && (
        <View style={styles.details}>
          {/* Previous performance */}
          {previousPerformance && previousPerformance.weight != null && (
            <View style={styles.lastTimeRow}>
              <Ionicons name="time-outline" size={14} color={colors.textTertiary} />
              <Text style={styles.lastTimeText}>
                Last time: {previousPerformance.weight}kg × {previousPerformance.reps} ({previousPerformance.date})
              </Text>
            </View>
          )}

          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Sets</Text>
              <Text style={styles.detailValue}>{exercise.sets}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Reps</Text>
              <Text style={styles.detailValue}>{exercise.reps}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Rest</Text>
              <Text style={styles.detailValue}>{exercise.restSeconds}s</Text>
            </View>
          </View>

          {/* Rest timer */}
          {isResting ? (
            <Pressable style={styles.restTimerActive} onPress={stopRestTimer}>
              <Ionicons name="timer-outline" size={16} color={colors.primary} />
              <Text style={styles.restTimerCount}>{restSeconds}s</Text>
              <Text style={styles.restTimerLabel}>rest remaining</Text>
              <Text style={styles.restTimerSkip}>skip</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.restTimerBtn} onPress={startRestTimer}>
              <Ionicons name="timer-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.restTimerBtnText}>Start {exercise.restSeconds}s Rest</Text>
            </Pressable>
          )}

          {/* Weight input for weighted exercises */}
          {exercise.weight != null && (
            <View style={styles.weightRow}>
              <Ionicons name="barbell-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.weightLabel}>Weight (kg):</Text>
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
              <Text style={styles.weightPrescribed}>target: {exercise.weight}kg</Text>
            </View>
          )}

          {/* Set-by-set rep tracking */}
          {hasFeedback && exercise.feedback !== 'skipped' && (
            <View style={styles.setTrackingBox}>
              <Text style={styles.setTrackingTitle}>Reps per set</Text>
              <View style={styles.setTrackingRow}>
                {Array.from({ length: exercise.sets }, (_, i) => {
                  const repsPerSet = exercise.actualRepsPerSet ?? [];
                  const val = repsPerSet[i];
                  return (
                    <View key={i} style={styles.setTrackingItem}>
                      <Text style={styles.setTrackingLabel}>S{i + 1}</Text>
                      <TextInput
                        style={styles.setTrackingInput}
                        keyboardType="numeric"
                        placeholder={String(exercise.reps)}
                        placeholderTextColor={colors.textMuted}
                        value={val != null ? String(val) : ''}
                        onChangeText={(text) => {
                          const current = [...(exercise.actualRepsPerSet ?? Array(exercise.sets).fill(exercise.reps))];
                          const parsed = parseInt(text, 10);
                          current[i] = isNaN(parsed) ? exercise.reps : parsed;
                          onActualsChange?.(exercise.id, { actualRepsPerSet: current });
                        }}
                      />
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Form cues */}
          {exercise.formCues && exercise.formCues.length > 0 && (
            <View style={styles.formCuesBox}>
              <View style={styles.formCuesHeader}>
                <Ionicons name="body-outline" size={14} color={colors.warning} />
                <Text style={styles.formCuesTitle}>Form Tips</Text>
              </View>
              {exercise.formCues.map((cue, i) => (
                <View key={i} style={styles.formCueRow}>
                  <Text style={styles.formCueBullet}>{'\u2022'}</Text>
                  <Text style={styles.formCueText}>{cue}</Text>
                </View>
              ))}
            </View>
          )}

          {exercise.notes ? (
            <Text style={styles.notes}>{exercise.notes}</Text>
          ) : null}

          {/* Feedback row */}
          <View style={styles.feedbackRow}>
            {FEEDBACK_OPTIONS.map((opt) => {
              const isSelected = exercise.feedback === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  style={[styles.feedbackBtn, isSelected && styles.feedbackBtnSelected]}
                  onPress={() => onFeedback(exercise.id, opt.value)}
                >
                  <Ionicons
                    name={opt.icon}
                    size={18}
                    color={isSelected ? '#fff' : colors.textSecondary}
                  />
                  <Text style={[styles.feedbackLabel, isSelected && styles.feedbackLabelSelected]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  cardDone: {
    borderLeftWidth: 3,
    borderLeftColor: colors.success,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  orderNum: {
    color: colors.textMuted,
    fontSize: 22,
    fontWeight: '700',
    fontFamily: fonts.bold,
    letterSpacing: 0.3,
    width: 28,
    textAlign: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 10,
  },
  swapBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    letterSpacing: 0.3,
    flexShrink: 1,
  },
  prBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  prBadgeText: {
    color: '#FFD700',
    fontSize: 9,
    fontWeight: '700',
    fontFamily: fonts.bold,
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  muscleChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  muscleText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    letterSpacing: 0.3,
  },
  setsReps: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
  },

  // Expanded
  details: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.dotInactive,
  },
  detailsGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
  },
  detailItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingVertical: 10,
  },
  detailLabel: {
    color: colors.textTertiary,
    fontSize: 11,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  detailValue: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: fonts.bold,
    letterSpacing: 0.3,
  },
  lastTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  lastTimeText: {
    color: colors.textTertiary,
    fontSize: 12,
    fontStyle: 'italic',
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
  },
  restTimerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingVertical: 10,
    marginBottom: 10,
  },
  restTimerBtnText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: fonts.medium,
    letterSpacing: 0.3,
  },
  restTimerActive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,212,255,0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.25)',
    paddingVertical: 12,
    marginBottom: 10,
  },
  restTimerCount: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '700',
    fontFamily: fonts.bold,
    fontVariant: ['tabular-nums'],
  },
  restTimerLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
  },
  restTimerSkip: {
    color: colors.textTertiary,
    fontSize: 12,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
    marginLeft: 8,
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  weightLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    fontFamily: fonts.medium,
    letterSpacing: 0.3,
  },
  weightInput: {
    backgroundColor: colors.surfaceElevated,
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: fonts.bold,
    letterSpacing: 0.3,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 60,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.dotInactive,
  },
  weightPrescribed: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
    marginLeft: 'auto',
  },
  setTrackingBox: {
    marginBottom: 10,
  },
  setTrackingTitle: {
    color: colors.textTertiary,
    fontSize: 11,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  setTrackingRow: {
    flexDirection: 'row',
    gap: 8,
  },
  setTrackingItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  setTrackingLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    letterSpacing: 0.3,
  },
  setTrackingInput: {
    backgroundColor: colors.background,
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: fonts.bold,
    letterSpacing: 0.3,
    borderRadius: 8,
    paddingVertical: 8,
    width: '100%',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.dotInactive,
  },
  formCuesBox: {
    backgroundColor: 'rgba(255,152,0,0.08)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  formCuesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  formCuesTitle: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  formCueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingVertical: 1,
  },
  formCueBullet: {
    color: colors.textTertiary,
    fontSize: 12,
    lineHeight: 18,
  },
  formCueText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
    lineHeight: 18,
    flex: 1,
  },
  notes: {
    color: colors.textSecondary,
    fontSize: 13,
    fontStyle: 'italic',
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
    marginBottom: 12,
  },
  feedbackRow: {
    flexDirection: 'row',
    gap: 8,
  },
  feedbackBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.background,
    minHeight: 48,
  },
  feedbackBtnSelected: {
    backgroundColor: colors.primary,
  },
  feedbackLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    fontFamily: fonts.medium,
    letterSpacing: 0.3,
  },
  feedbackLabelSelected: {
    color: '#fff',
  },
});
