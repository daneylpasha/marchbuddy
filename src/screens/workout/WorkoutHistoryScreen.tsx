import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useWorkoutStore } from '../../store/workoutStore';
import { useAuthStore } from '../../store/authStore';
import BebasText from '../../components/common/BebasText';
import LoadingScreen from '../../components/common/LoadingScreen';
import type { WorkoutPlan } from '../../types';
import { colors, spacing, fonts } from '../../theme';

type FilterType = 'all' | 'week' | 'month';

const MUSCLE_COLORS: Record<string, string> = {
  Legs: colors.muscleLegs,
  Chest: colors.muscleChest,
  Back: colors.muscleBack,
  Shoulders: colors.muscleShoulders,
  Core: colors.muscleCore,
  Arms: colors.muscleArms,
};

function isWithinDays(dateStr: string, days: number): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  return diff <= days * 24 * 60 * 60 * 1000;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getMuscleGroups(workout: WorkoutPlan): string[] {
  return [...new Set(workout.exercises.map((e) => e.muscleGroup))];
}

export default function WorkoutHistoryScreen() {
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);
  const { workoutHistory, historyLoading, fetchWorkoutHistory } = useWorkoutStore();
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchWorkoutHistory(user.id);
  }, [user, fetchWorkoutHistory]);

  const filtered = workoutHistory.filter((w) => {
    if (filter === 'week') return isWithinDays(w.date, 7);
    if (filter === 'month') return isWithinDays(w.date, 30);
    return true;
  });

  const toggleExpand = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const renderItem = useCallback(({ item }: { item: WorkoutPlan }) => {
    const muscles = getMuscleGroups(item);
    const isExpanded = expandedId === item.id;
    const completedCount = item.exercises.filter((e) => e.feedback === 'completed' || e.feedback === 'too-easy').length;

    return (
      <Pressable style={styles.card} onPress={() => toggleExpand(item.id)}>
        {/* Header row */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.dateText}>{formatDateLabel(item.date)}</Text>
            <View style={[styles.statusBadge, { backgroundColor: item.status === 'completed' ? colors.success + '22' : colors.textSecondary + '22' }]}>
              <Text style={[styles.statusText, { color: item.status === 'completed' ? colors.success : colors.textSecondary }]}>
                {item.status === 'completed' ? 'Completed' : 'Skipped'}
              </Text>
            </View>
          </View>
          <View style={styles.cardHeaderRight}>
            {item.sessionRPE != null && (
              <View style={styles.rpeBadge}>
                <Text style={styles.rpeText}>RPE {item.sessionRPE}</Text>
              </View>
            )}
            <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textTertiary} />
          </View>
        </View>

        {/* Quick stats */}
        <View style={styles.quickStats}>
          <Text style={styles.exerciseCount}>{item.exercises.length} exercises</Text>
          <Text style={styles.completedCount}>{completedCount} done</Text>
        </View>

        {/* Muscle chips */}
        <View style={styles.muscleRow}>
          {muscles.map((group) => (
            <View key={group} style={[styles.muscleChip, { backgroundColor: (MUSCLE_COLORS[group] ?? colors.textSecondary) + '22' }]}>
              <Text style={[styles.muscleChipText, { color: MUSCLE_COLORS[group] ?? colors.textSecondary }]}>{group}</Text>
            </View>
          ))}
        </View>

        {/* Expanded exercise details */}
        {isExpanded && (
          <View style={styles.expandedDetails}>
            {item.exercises.map((ex) => (
              <View key={ex.id} style={styles.exerciseRow}>
                <Text style={styles.exerciseOrder}>{ex.order}</Text>
                <View style={styles.exerciseInfo}>
                  <Text style={styles.exerciseName}>{ex.name}</Text>
                  <Text style={styles.exerciseMeta}>
                    {ex.sets}×{ex.reps}
                    {ex.actualWeight != null ? ` @ ${ex.actualWeight}kg` : ex.weight != null ? ` @ ${ex.weight}kg` : ''}
                  </Text>
                </View>
                <View style={styles.feedbackIcon}>
                  {ex.feedback === 'completed' && <Ionicons name="checkmark-circle" size={16} color={colors.success} />}
                  {ex.feedback === 'skipped' && <Ionicons name="play-skip-forward" size={16} color={colors.textMuted} />}
                  {ex.feedback === 'too-easy' && <Ionicons name="flash" size={16} color={colors.warning} />}
                  {ex.feedback === 'too-hard' && <Ionicons name="barbell" size={16} color={colors.danger} />}
                </View>
              </View>
            ))}
            {item.aiNotes ? (
              <View style={styles.aiNotesRow}>
                <Ionicons name="sparkles" size={12} color={colors.primary} />
                <Text style={styles.aiNotesText}>{item.aiNotes}</Text>
              </View>
            ) : null}
          </View>
        )}
      </Pressable>
    );
  }, [expandedId, toggleExpand]);

  if (historyLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <LoadingScreen message="Loading history..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <BebasText size={28}>Workout History</BebasText>
        <View style={{ width: 24 }} />
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {(['all', 'week', 'month'] as FilterType[]).map((f) => (
          <Pressable
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'All' : f === 'week' ? 'This Week' : 'This Month'}
            </Text>
          </Pressable>
        ))}
      </View>

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="fitness-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>No workout history yet</Text>
          <Text style={styles.emptyHint}>Complete a workout to see it here</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 10,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: spacing.screenPadding,
    marginBottom: 14,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
  },
  filterChipActive: {
    backgroundColor: colors.primaryDim,
  },
  filterText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    fontFamily: fonts.medium,
    letterSpacing: 0.3,
  },
  filterTextActive: {
    color: colors.primary,
  },
  list: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    letterSpacing: 0.3,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    letterSpacing: 0.3,
  },
  rpeBadge: {
    backgroundColor: colors.warning + '22',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  rpeText: {
    color: colors.warning,
    fontSize: 11,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    letterSpacing: 0.3,
  },
  quickStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  exerciseCount: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
  },
  completedCount: {
    color: colors.success,
    fontSize: 13,
    fontFamily: fonts.medium,
    letterSpacing: 0.3,
  },
  muscleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  muscleChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  muscleChipText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    letterSpacing: 0.3,
  },
  expandedDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.dotInactive,
    gap: 8,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  exerciseOrder: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.bold,
    width: 20,
    textAlign: 'center',
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
    fontFamily: fonts.medium,
    letterSpacing: 0.3,
  },
  exerciseMeta: {
    color: colors.textTertiary,
    fontSize: 12,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
  },
  feedbackIcon: {
    width: 20,
    alignItems: 'center',
  },
  aiNotesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 6,
    backgroundColor: colors.primaryDim,
    borderRadius: 8,
    padding: 10,
  },
  aiNotesText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontStyle: 'italic',
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
    flex: 1,
    lineHeight: 18,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    padding: 24,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '500',
    fontFamily: fonts.medium,
  },
  emptyHint: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: fonts.regular,
  },
});
