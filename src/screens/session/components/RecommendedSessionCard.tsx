import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SessionPlan } from '../../../types/session';
import { formatDurationMinutes } from '../../../utils/sessionUtils';
import { colors, fonts, spacing } from '../../../theme';

interface RecommendedSessionCardProps {
  plan: SessionPlan;
  onPress: () => void;
}

export const RecommendedSessionCard: React.FC<RecommendedSessionCardProps> = ({
  plan,
  onPress,
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
      {/* Recommended badge */}
      <View style={styles.badge}>
        <Text style={styles.badgeText}>RECOMMENDED</Text>
      </View>

      {/* Title */}
      <Text style={styles.title}>{plan.title}</Text>

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

      {/* CTA */}
      <View style={styles.button}>
        <Text style={styles.buttonText}>Start This Session</Text>
      </View>
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
  containerPressed: { opacity: 0.85 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryDim,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 16,
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.primary,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
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
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonText: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: '#fff',
  },
});
