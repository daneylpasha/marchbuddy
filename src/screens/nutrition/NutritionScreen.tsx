import React, { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ProgressRing from '../../components/common/ProgressRing';
import MacroBar from '../../components/nutrition/MacroBar';
import MealCard from '../../components/nutrition/MealCard';
import FoodSnapCard from '../../components/nutrition/FoodSnapCard';
import BebasText from '../../components/common/BebasText';
import { useNutritionStore } from '../../store/nutritionStore';
import { useAuthStore } from '../../store/authStore';
import type { Meal } from '../../types';
import type { NutritionStackParamList } from './NutritionNavigator';
import { colors, spacing, fonts } from '../../theme';

type NavProp = NativeStackNavigationProp<NutritionStackParamList>;

export default function NutritionScreen() {
  const navigation = useNavigation<NavProp>();
  const user = useAuthStore((s) => s.user);
  const {
    todayMealPlan,
    foodSnaps,
    fetchTodayMealPlan,
    updateMealFeedback,
    getConsumedTotals,
  } = useNutritionStore();

  useEffect(() => {
    if (!todayMealPlan && user) {
      fetchTodayMealPlan(user.id);
    }
  }, [todayMealPlan, user, fetchTodayMealPlan]);

  const consumed = getConsumedTotals();
  const plan = todayMealPlan;
  const targetCal = plan?.totalCalories ?? 2100;
  const targetP = plan?.totalProtein ?? 120;
  const targetC = plan?.totalCarbs ?? 200;
  const targetF = plan?.totalFat ?? 60;

  const handleFeedback = (mealId: string, feedback: Meal['feedback'], swapDescription?: string, swapNutrition?: { calories: number; protein: number; carbs: number; fat: number }) => {
    updateMealFeedback(mealId, feedback, swapDescription, swapNutrition);
  };

  const remaining = Math.max(targetCal - consumed.calories, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Header ─────────────────────────────────────────── */}
        <BebasText>Today's Nutrition</BebasText>
        <Text style={styles.date}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </Text>

        {/* ── Calorie overview ───────────────────────────────── */}
        <View style={styles.calorieSection}>
          <ProgressRing current={consumed.calories} total={targetCal} size={130} strokeWidth={10} label="cal" />
          <View style={styles.calorieInfo}>
            <Text style={styles.calorieConsumed}>{consumed.calories}</Text>
            <Text style={styles.calorieTarget}>/ {targetCal} cal</Text>
            <Text style={[styles.calorieRemaining, remaining === 0 && styles.calorieGoalHit]}>
              {remaining === 0 ? 'Goal reached!' : `${remaining} remaining`}
            </Text>
          </View>
        </View>

        {/* ── Macro bars ─────────────────────────────────────── */}
        <View style={styles.macroSection}>
          <MacroBar label="Protein" current={consumed.protein} total={targetP} color={colors.protein} />
          <MacroBar label="Carbs" current={consumed.carbs} total={targetC} color={colors.carbs} />
          <MacroBar label="Fat" current={consumed.fat} total={targetF} color={colors.fat} />
        </View>

        {/* ── Meal cards ─────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Meals</Text>
        {plan?.meals.map((meal) => (
          <MealCard key={meal.id} meal={meal} onFeedback={handleFeedback} />
        ))}

        {!plan && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No meal plan for today yet.</Text>
          </View>
        )}

        {/* ── Food Snap ──────────────────────────────────────── */}
        <Pressable style={styles.snapCard} onPress={() => navigation.navigate('FoodSnap')}>
          <View style={styles.snapIconRow}>
            <View style={styles.snapIconCircle}>
              <Ionicons name="camera" size={24} color={colors.primary} />
            </View>
            <View style={styles.snapInfo}>
              <Text style={styles.snapTitle}>Snap Your Food</Text>
              <Text style={styles.snapSubtitle}>Take a photo for instant calorie estimate</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </View>
        </Pressable>

        {/* ── Food snap list ──────────────────────────────────── */}
        {foodSnaps.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Food Snaps Today</Text>
            {foodSnaps.map((snap) => (
              <FoodSnapCard key={snap.id} snap={snap} />
            ))}
          </>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: spacing.screenPadding },

  title: {},
  date: { color: colors.textSecondary, fontSize: 14, marginTop: 3, marginBottom: 22, fontFamily: fonts.regular, letterSpacing: 0.3 },

  // Calorie section
  calorieSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: spacing.cardRadius,
    padding: 20,
    gap: 22,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  calorieInfo: { flex: 1 },
  calorieConsumed: { color: colors.textPrimary, fontSize: 42, fontWeight: '700', fontVariant: ['tabular-nums'], fontFamily: fonts.bold, letterSpacing: 0.3 },
  calorieTarget: { color: colors.textSecondary, fontSize: 16, marginTop: -2, fontFamily: fonts.regular, letterSpacing: 0.3 },
  calorieRemaining: { color: colors.primary, fontSize: 14, fontWeight: '500', marginTop: 8, fontFamily: fonts.medium, letterSpacing: 0.3 },
  calorieGoalHit: { color: colors.success },

  // Macros
  macroSection: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: spacing.cardRadius,
    padding: spacing.cardPadding,
    gap: 16,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },

  // Sections
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 14,
    marginTop: 4,
    fontFamily: fonts.semiBold,
    letterSpacing: 0.3,
  },

  // Empty state
  emptyCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: spacing.cardRadius,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: { color: colors.textSecondary, fontSize: 14, fontFamily: fonts.regular, letterSpacing: 0.3 },

  // Snap card
  snapCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: spacing.cardRadius,
    padding: spacing.cardPadding,
    marginBottom: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  snapIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  snapIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  snapInfo: { flex: 1 },
  snapTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '600', fontFamily: fonts.semiBold, letterSpacing: 0.3 },
  snapSubtitle: { color: colors.textSecondary, fontSize: 12, marginTop: 2, fontFamily: fonts.regular, letterSpacing: 0.3 },

  bottomSpacer: { height: 20 },
});
