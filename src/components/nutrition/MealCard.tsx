import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Meal } from '../../types';
import { colors, fonts, spacing } from '../../theme';
import { estimateSwapNutrition } from '../../services/aiService';

interface MealCardProps {
  meal: Meal;
  onFeedback: (mealId: string, feedback: Meal['feedback'], swapDescription?: string, swapNutrition?: { calories: number; protein: number; carbs: number; fat: number }) => void;
}

const MEAL_EMOJI: Record<Meal['type'], string> = {
  breakfast: '\uD83C\uDF05',
  lunch: '\u2600\uFE0F',
  dinner: '\uD83C\uDF19',
  snack: '\uD83C\uDF4E',
};

interface FeedbackOption {
  value: Meal['feedback'];
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}

const FEEDBACK_OPTIONS: FeedbackOption[] = [
  { value: 'ate-it', icon: 'checkmark-circle', label: 'Ate It' },
  { value: 'swapped', icon: 'swap-horizontal', label: 'Swapped' },
  { value: 'skipped', icon: 'close-circle', label: 'Skipped' },
];

function getFeedbackStyle(feedback: Meal['feedback']) {
  switch (feedback) {
    case 'ate-it': return { bg: colors.successDim, border: 'rgba(0,230,118,0.2)' };
    case 'swapped': return { bg: colors.warningDim, border: 'rgba(255,152,0,0.2)' };
    case 'skipped': return { bg: 'rgba(136,136,136,0.08)', border: 'rgba(136,136,136,0.15)' };
    default: return { bg: 'transparent', border: 'transparent' };
  }
}

export default function MealCard({ meal, onFeedback }: MealCardProps) {
  const [swapText, setSwapText] = useState(meal.swapDescription ?? '');
  const [isEstimating, setIsEstimating] = useState(false);
  const fbStyle = getFeedbackStyle(meal.feedback);

  const handleFeedback = (feedback: Meal['feedback']) => {
    onFeedback(meal.id, feedback);
  };

  const handleSwapSubmit = async () => {
    if (!swapText.trim()) return;

    setIsEstimating(true);
    try {
      const nutrition = await estimateSwapNutrition(swapText.trim());
      onFeedback(meal.id, 'swapped', swapText.trim(), nutrition);
    } catch (e) {
      console.error('[MealCard] swap estimation failed:', e);
      // Fall back to saving without nutrition estimation
      onFeedback(meal.id, 'swapped', swapText.trim());
    } finally {
      setIsEstimating(false);
    }
  };

  // Show swap nutrition if available, otherwise original
  const isSwapped = meal.feedback === 'swapped';
  const displayCal = isSwapped && meal.swapCalories != null ? meal.swapCalories : meal.calories;
  const displayProtein = isSwapped && meal.swapProtein != null ? meal.swapProtein : meal.protein;
  const displayCarbs = isSwapped && meal.swapCarbs != null ? meal.swapCarbs : meal.carbs;
  const displayFat = isSwapped && meal.swapFat != null ? meal.swapFat : meal.fat;

  return (
    <View style={[styles.card, { backgroundColor: meal.feedback ? undefined : colors.surfaceElevated, borderColor: fbStyle.border }]}>
      {meal.feedback && <View style={[StyleSheet.absoluteFill, styles.feedbackOverlay, { backgroundColor: fbStyle.bg }]} />}

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.emoji}>{MEAL_EMOJI[meal.type]}</Text>
        <View style={styles.headerInfo}>
          <Text style={styles.mealType}>{meal.type.charAt(0).toUpperCase() + meal.type.slice(1)}</Text>
          <Text style={[styles.mealName, meal.feedback === 'skipped' && styles.mealNameSkipped]}>
            {meal.name}
          </Text>
        </View>
        <Text style={styles.mealCal}>{displayCal} cal</Text>
      </View>

      {/* Description */}
      <Text style={styles.description}>{meal.description}</Text>

      {/* Macros */}
      <View style={styles.macroRow}>
        <Text style={[styles.macroItem, { color: colors.protein }]}>P {displayProtein}g</Text>
        <Text style={styles.macroDot}>{'\u00B7'}</Text>
        <Text style={[styles.macroItem, { color: colors.carbs }]}>C {displayCarbs}g</Text>
        <Text style={styles.macroDot}>{'\u00B7'}</Text>
        <Text style={[styles.macroItem, { color: colors.fat }]}>F {displayFat}g</Text>
      </View>

      {/* Feedback buttons */}
      <View style={styles.feedbackRow}>
        {FEEDBACK_OPTIONS.map((opt) => {
          const isSelected = meal.feedback === opt.value;
          return (
            <Pressable
              key={opt.value}
              style={[styles.feedbackBtn, isSelected && styles.feedbackBtnSelected]}
              onPress={() => handleFeedback(opt.value)}
            >
              <Ionicons name={opt.icon} size={16} color={isSelected ? '#fff' : colors.textSecondary} />
              <Text style={[styles.feedbackLabel, isSelected && styles.feedbackLabelSelected]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Swap input */}
      {meal.feedback === 'swapped' && (
        <View style={styles.swapRow}>
          {isEstimating ? (
            <View style={styles.swapEstimating}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.swapEstimatingText}>Estimating nutrition...</Text>
            </View>
          ) : meal.swapDescription ? (
            <View style={styles.swapSaved}>
              <Ionicons name="swap-horizontal" size={14} color={colors.warning} />
              <Text style={styles.swapSavedText}>{meal.swapDescription}</Text>
            </View>
          ) : (
            <TextInput
              style={styles.swapInput}
              placeholder="What did you eat instead?"
              placeholderTextColor={colors.textTertiary}
              value={swapText}
              onChangeText={setSwapText}
              onSubmitEditing={handleSwapSubmit}
              returnKeyType="done"
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: spacing.cardRadius,
    padding: spacing.cardPadding,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  feedbackOverlay: {
    borderRadius: spacing.cardRadius,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  emoji: {
    fontSize: 28,
  },
  headerInfo: {
    flex: 1,
  },
  mealType: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    fontFamily: fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  mealName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    letterSpacing: 0.3,
    marginTop: 2,
  },
  mealNameSkipped: {
    textDecorationLine: 'line-through',
    color: colors.textTertiary,
  },
  mealCal: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    letterSpacing: 0.3,
    fontVariant: ['tabular-nums'],
  },
  description: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
    lineHeight: 19,
    marginBottom: 10,
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  macroItem: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    letterSpacing: 0.3,
  },
  macroDot: {
    color: '#444',
    fontSize: 12,
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
    gap: 5,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.background,
    minHeight: 48,
  },
  feedbackBtnSelected: {
    backgroundColor: colors.primary,
  },
  feedbackLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    fontFamily: fonts.medium,
    letterSpacing: 0.3,
  },
  feedbackLabelSelected: {
    color: '#fff',
  },
  swapRow: {
    marginTop: 10,
  },
  swapInput: {
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
    color: colors.textPrimary,
    minHeight: 48,
  },
  swapEstimating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  swapEstimatingText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: fonts.medium,
    letterSpacing: 0.3,
  },
  swapSaved: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  swapSavedText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
    flex: 1,
  },
});
