import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
      {/* Title — Bebas Neue hero moment */}
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
  title: {
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
