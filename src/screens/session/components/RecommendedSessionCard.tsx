import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SessionPlan } from '../../../types/session';
import { formatDurationMinutes } from '../../../utils/sessionUtils';
import { colors, fonts, spacing } from '../../../theme';

interface RecommendedSessionCardProps {
  plan: SessionPlan;
  onPress: () => void;
  onSchedule?: () => void;
  isScheduled?: boolean;
}

export const RecommendedSessionCard: React.FC<RecommendedSessionCardProps> = ({
  plan,
  onPress,
  onSchedule,
  isScheduled,
}) => {
  const getDifficultyColor = () => {
    switch (plan.difficulty) {
      case 'easy':        return colors.success;
      case 'moderate':    return colors.primary;
      case 'challenging': return colors.warning;
      case 'hard':        return colors.danger;
      default:            return colors.primary;
    }
  };

  const difficultyLabel =
    plan.difficulty.charAt(0).toUpperCase() + plan.difficulty.slice(1);

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.containerPressed]}
      onPress={onPress}
    >
      {/* Title row with schedule icon */}
      <View style={styles.titleRow}>
        <Text style={styles.title}>{plan.title}</Text>
        {onSchedule && (
          <Pressable
            style={styles.scheduleIcon}
            onPress={onSchedule}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={isScheduled ? 'calendar' : 'calendar-outline'}
              size={22}
              color={isScheduled ? colors.primary : colors.textTertiary}
            />
            {isScheduled && <View style={styles.scheduleDot} />}
          </Pressable>
        )}
      </View>

      {/* Meta row */}
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>{formatDurationMinutes(plan.totalDurationMinutes)}</Text>
        <View style={styles.dot} />
        <Text style={[styles.metaText, { color: getDifficultyColor() }]}>
          {difficultyLabel}
        </Text>
        <View style={styles.dot} />
        <Text style={styles.metaText}>Level {plan.level}</Text>
      </View>

      {/* Summary */}
      <Text style={styles.summary}>{plan.summary}</Text>

      {/* CTA — prominent, action-oriented */}
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={onPress}
      >
        <Text style={styles.buttonText}>Let's Go</Text>
        <Ionicons name="arrow-forward" size={18} color="#fff" />
      </Pressable>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 20,
    padding: spacing.cardPadding,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  containerPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  scheduleIcon: {
    padding: 4,
    marginTop: 4,
  },
  scheduleDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  title: {
    flex: 1,
    fontFamily: fonts.titleRegular,
    fontSize: 36,
    color: colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  metaText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textTertiary,
    marginHorizontal: 8,
  },
  summary: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  button: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: '#fff',
    letterSpacing: 0.5,
  },
});
