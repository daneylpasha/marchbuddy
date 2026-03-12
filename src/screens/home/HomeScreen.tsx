import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Card from '../../components/common/Card';
import ProgressRing from '../../components/common/ProgressRing';
import ProgressBar from '../../components/common/ProgressBar';
import LoadingScreen from '../../components/common/LoadingScreen';
import BebasText from '../../components/common/BebasText';
import { useProfileStore } from '../../store/profileStore';
import { useWaterStore } from '../../store/waterStore';
import { useWorkoutStore } from '../../store/workoutStore';
import { useNutritionStore } from '../../store/nutritionStore';
import { useAuthStore } from '../../store/authStore';
import { useProgressStore } from '../../store/progressStore';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { generateTodaysPlan } from '../../services/dailyPlanService';
import { deleteTodayPlans, getRecentWorkoutDates, getWeightEntries } from '../../api/database';
import { formatDate, getToday, computeMissedDays } from '../../utils/dateUtils';
import WelcomeBackCard from '../../components/home/WelcomeBackCard';
import StreakMilestoneModal, { isMilestoneDay } from '../../components/home/StreakMilestoneModal';
import type { MainTabParamList } from '../../navigation/MainTabNavigator';
import type { HomeStackParamList } from '../../navigation/HomeNavigator';
import type { Meal, WorkoutPlan, WeightEntry } from '../../types';
import { colors, spacing, fonts } from '../../theme';
import { MOCK_MODE, injectMockData } from '../../mock';
import { mockWorkoutDates, mockWeightEntries } from '../../mock/progress';

type NavProp = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList>,
  BottomTabNavigationProp<MainTabParamList>
>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getMuscleGroupsArray(workout: WorkoutPlan): string[] {
  return [...new Set(workout.exercises.map((e) => e.muscleGroup))];
}

function getMuscleGroupColor(group: string): string {
  const g = group.toLowerCase();
  if (g.includes('leg') || g.includes('glute') || g.includes('calf')) return colors.muscleLegs;
  if (g.includes('chest') || g.includes('pec')) return colors.muscleChest;
  if (g.includes('back') || g.includes('lat')) return colors.muscleBack;
  if (g.includes('shoulder') || g.includes('delt')) return colors.muscleShoulders;
  if (g.includes('core') || g.includes('ab')) return colors.muscleCore;
  if (g.includes('arm') || g.includes('bicep') || g.includes('tricep')) return colors.muscleArms;
  return colors.primary;
}

function estimateDuration(workout: WorkoutPlan): number {
  return Math.round(workout.exercises.length * 3.5);
}

function getStatusColor(status: WorkoutPlan['status']): string {
  switch (status) {
    case 'completed': return colors.success;
    case 'in-progress': return colors.warning;
    case 'skipped': return colors.textSecondary;
    default: return colors.primary;
  }
}

function getMealFeedbackColor(feedback: Meal['feedback']): string {
  switch (feedback) {
    case 'ate-it': return colors.success;
    case 'swapped': return colors.warning;
    case 'skipped': return colors.danger;
    default: return colors.textTertiary;
  }
}

const WEEK_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Compute consecutive days ending at today from a set of active date strings. */
function computeStreak(activeDates: Set<string>): number {
  let streak = 0;
  const d = new Date();
  while (true) {
    const key = d.toISOString().split('T')[0];
    if (!activeDates.has(key)) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

/** Get day-of-week indices (Mon=1..Sun=0) for this week's active dates. */
function getActiveWeekDays(activeDates: Set<string>): number[] {
  const result: number[] = [];
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = d.toISOString().split('T')[0];
    if (activeDates.has(key)) {
      result.push(i === 6 ? 0 : i + 1); // map to M=1..S=0
    }
  }
  return result;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const navigation = useNavigation<NavProp>();
  const profile = useProfileStore((s) => s.profile);
  const waterLog = useWaterStore((s) => s.todayWaterLog);
  const logWater = useWaterStore((s) => s.logWater);
  const todayWorkout = useWorkoutStore((s) => s.todayWorkout);
  const todayMealPlan = useNutritionStore((s) => s.todayMealPlan);
  const userId = useAuthStore((s) => s.user?.id);
  const { isConnected } = useNetworkStatus();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [planFailed, setPlanFailed] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [streakDays, setStreakDays] = useState(0);
  const [activeDays, setActiveDays] = useState<number[]>([]);
  const [missedDays, setMissedDays] = useState(0);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [showStreakMilestone, setShowStreakMilestone] = useState(false);
  const [weeklyWorkouts, setWeeklyWorkouts] = useState(0);
  const [weightChange, setWeightChange] = useState<number | null>(null);
  const [startingWeight, setStartingWeight] = useState<number | null>(null);

  // Fetch streak data + weekly stats
  const fetchStreak = useCallback(async (uid: string) => {
    const entries = await getRecentWorkoutDates(uid, 90);
    const dates = new Set(entries.map((e) => e.date));
    const streak = computeStreak(dates);
    setStreakDays(streak);
    const activeWeek = getActiveWeekDays(dates);
    setActiveDays(activeWeek);
    setWeeklyWorkouts(activeWeek.length);

    // Milestone celebration
    if (streak > 0 && isMilestoneDay(streak)) {
      setShowStreakMilestone(true);
    }

    // Comeback detection
    const missed = computeMissedDays(entries);
    setMissedDays(missed);
    if (missed >= 1) {
      setShowWelcomeBack(true);
    }

    // Weight trend (last 7 days) + starting weight for journey
    try {
      const weightEntries = await getWeightEntries(uid);
      if (weightEntries.length >= 1) {
        // First ever entry = starting weight for journey progress
        setStartingWeight(weightEntries[0].weight);
      }
      if (weightEntries.length >= 2) {
        const latest = weightEntries[weightEntries.length - 1].weight;
        // Find entry from ~7 days ago
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekAgoStr = weekAgo.toISOString().split('T')[0];
        const older = weightEntries.reduce((closest: WeightEntry | null, e) => {
          if (e.date <= weekAgoStr) {
            if (!closest || e.date > closest.date) return e;
          }
          return closest;
        }, null);
        if (older) {
          setWeightChange(+(latest - older.weight).toFixed(1));
        }
      }
    } catch {}
  }, []);

  // Generate daily plan on mount (or inject mock data)
  useEffect(() => {
    if (initialized) return;

    // ── Mock mode: populate stores + local state, skip all API calls ──
    if (MOCK_MODE) {
      injectMockData();
      const dates = new Set(mockWorkoutDates.map((e) => e.date));
      setStreakDays(computeStreak(dates));
      const activeWeek = getActiveWeekDays(dates);
      setActiveDays(activeWeek);
      setWeeklyWorkouts(activeWeek.length);
      if (mockWeightEntries.length >= 2) {
        const latest = mockWeightEntries[mockWeightEntries.length - 1].weight;
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekAgoStr = weekAgo.toISOString().split('T')[0];
        const older = mockWeightEntries.reduce((closest: WeightEntry | null, e) => {
          if (e.date <= weekAgoStr) {
            if (!closest || e.date > closest.date) return e;
          }
          return closest;
        }, null);
        if (older) setWeightChange(+(latest - older.weight).toFixed(1));
      }
      setInitialized(true);
      return;
    }

    // ── Production: fetch from Supabase ──
    if (!userId) return;
    setInitialized(true);
    setLoading(true);

    Promise.all([
      generateTodaysPlan(userId),
      fetchStreak(userId),
    ])
      .then(([result]) => {
        useWorkoutStore.setState({ todayWorkout: result.workout });
        useNutritionStore.setState({ todayMealPlan: result.mealPlan });
        useWaterStore.setState({ todayWaterLog: result.waterLog });
        setPlanFailed(result.status === 'failed');
      })
      .catch((e) => {
        console.error('[HomeScreen] plan generation failed:', e);
        setPlanFailed(true);
      })
      .finally(() => setLoading(false));
  }, [userId, initialized, fetchStreak]);

  // Re-fetch streak when workout status changes (e.g. completed)
  useEffect(() => {
    if (userId && !MOCK_MODE && todayWorkout?.status === 'completed') {
      fetchStreak(userId);
    }
  }, [userId, todayWorkout?.status, fetchStreak]);

  // Seed initial weight entry from profile if weight_entries table is empty
  useEffect(() => {
    if (!userId || !profile?.currentWeight || MOCK_MODE) return;
    const entries = useProgressStore.getState().weightEntries;
    if (entries.length === 0 && profile.currentWeight > 0) {
      useProgressStore.getState().logWeight(userId, profile.currentWeight);
    }
  }, [userId, profile?.currentWeight]);

  // Pull-to-refresh handler
  const handleRefresh = useCallback(() => {
    if (!userId) return;

    // In mock mode, just re-inject mock data
    if (MOCK_MODE) {
      setRefreshing(true);
      injectMockData();
      setTimeout(() => setRefreshing(false), 300);
      return;
    }

    Alert.alert(
      'Refresh Plan',
      'This will regenerate your daily plan. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Refresh',
          onPress: async () => {
            setRefreshing(true);
            try {
              // Clear local state and delete from Supabase so plans are regenerated
              useWorkoutStore.setState({ todayWorkout: null });
              useNutritionStore.setState({ todayMealPlan: null });

              await deleteTodayPlans(userId, getToday());

              const result = await generateTodaysPlan(userId);
              useWorkoutStore.setState({ todayWorkout: result.workout });
              useNutritionStore.setState({ todayMealPlan: result.mealPlan });
              useWaterStore.setState({ todayWaterLog: result.waterLog });
              setPlanFailed(result.status === 'failed');
              await fetchStreak(userId);
            } catch (e) {
              console.error('[HomeScreen] refresh failed:', e);
            } finally {
              setRefreshing(false);
            }
          },
        },
      ],
    );
    // If user cancels, stop the refreshing spinner
    setTimeout(() => setRefreshing(false), 500);
  }, [userId]);

  const name = profile?.name ?? 'there';

  // Journey progress calculations
  const currentWeight = profile?.currentWeight ?? 0;
  const targetWeight = profile?.targetWeight ?? profile?.goals?.targetWeight ?? 0;
  const weightDiff = Math.abs(currentWeight - targetWeight);
  // Use first ever weight entry as starting point for journey
  const totalGap = startingWeight != null ? Math.abs(startingWeight - targetWeight) : 0;
  const progressMade = totalGap > 0 ? totalGap - weightDiff : 0;
  const journeyPercent = totalGap > 0 && currentWeight !== targetWeight
    ? Math.min(Math.max(Math.round((progressMade / totalGap) * 100), 0), 99)
    : currentWeight === targetWeight && totalGap > 0 ? 100 : 0;

  const consumedCals = todayMealPlan
    ? todayMealPlan.meals
        .filter((m) => m.feedback === 'ate-it' || m.feedback === 'swapped')
        .reduce((sum, m) => sum + (m.feedback === 'swapped' && m.swapCalories != null ? m.swapCalories : m.calories), 0)
    : 0;

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <LoadingScreen message="Setting up your day..." submessage="Generating your personalized plan" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >

        {/* ── Header ───────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <BebasText size={28}>{getGreeting()}, {name}</BebasText>
            <Text style={styles.date}>{formatDate()}</Text>
          </View>
          <Pressable style={styles.settingsBtn} onPress={() => navigation.navigate('Settings')} accessibilityRole="button" accessibilityLabel="Settings">
            <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* ── Stats Summary Bar ───────────────────────────────── */}
        <View style={styles.statsSummary}>
          <View style={styles.summaryItem}>
            <Ionicons name="scale-outline" size={14} color={colors.textTertiary} style={styles.summaryIcon} />
            <Text style={styles.summaryValue}>
              {profile?.currentWeight ? `${profile.currentWeight}` : '--'}
              <Text style={styles.summaryUnit}> kg</Text>
            </Text>
            {weightChange !== null && (
              <View style={styles.summaryTrendRow}>
                <Ionicons
                  name={weightChange <= 0 ? 'trending-down' : 'trending-up'}
                  size={12}
                  color={weightChange <= 0 ? colors.success : colors.warning}
                />
                <Text style={[styles.summaryTrend, { color: weightChange <= 0 ? colors.success : colors.warning }]}>
                  {weightChange > 0 ? '+' : ''}{weightChange}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Ionicons name="barbell-outline" size={14} color={colors.textTertiary} style={styles.summaryIcon} />
            <Text style={styles.summaryValue}>{weeklyWorkouts}/{profile?.workoutSchedule?.daysPerWeek ?? '7'}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Ionicons name="flame" size={18} color={colors.streak} style={styles.summaryIcon} />
            <Text style={styles.summaryValue}>{streakDays}</Text>
          </View>
        </View>

        {/* ── Progress Journey Card ─────────────────────────── */}
        {currentWeight > 0 && targetWeight > 0 && (
          <Card onPress={() => navigation.navigate('Progress' as any)} style={styles.journeyCard}>
            <Text style={styles.journeyLabel}>YOUR JOURNEY</Text>
            <View style={styles.journeyBody}>
              <ProgressRing
                current={journeyPercent}
                total={100}
                size={120}
                strokeWidth={12}
                color={colors.primary}
                customCenter={
                  <View style={styles.journeyArcCenter}>
                    <Text style={styles.journeyPercent}>{journeyPercent}%</Text>
                  </View>
                }
              />
              <View style={styles.journeyStats}>
                <View style={styles.journeyStatRow}>
                  <Text style={styles.journeyStatLabel}>Current</Text>
                  <Text style={styles.journeyStatValue}>{currentWeight} kg</Text>
                </View>
                <View style={styles.journeyStatRow}>
                  <Text style={styles.journeyStatLabel}>Target</Text>
                  <Text style={styles.journeyStatValue}>{targetWeight} kg</Text>
                </View>
                <View style={styles.journeyDivider} />
                <View style={styles.journeyStatRow}>
                  <Text style={styles.journeyStatLabel}>To go</Text>
                  <Text style={styles.journeyHighlight}>{weightDiff} kg</Text>
                </View>
                {profile?.goals?.targetTimeline ? (
                  <View style={styles.journeyStatRow}>
                    <Text style={styles.journeyStatLabel}>Timeline</Text>
                    <Text style={styles.journeyStatValue}>{profile.goals.targetTimeline}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </Card>
        )}

        {/* ── This Week Summary ────────────────────────────────── */}
        <Card>
          <View style={styles.weekHeader}>
            <Text style={styles.weekLabel}>THIS WEEK</Text>
            <Ionicons name="calendar-outline" size={14} color={colors.primary} />
          </View>
          <View style={styles.weekStats}>
            <View style={styles.weekStatItem}>
              <Text style={styles.weekStatValue}>{weeklyWorkouts}</Text>
              <Text style={styles.weekStatLabel}>workouts</Text>
            </View>
            <View style={styles.weekStatItem}>
              <Text style={styles.weekStatValue}>{weeklyWorkouts > 0 ? Math.round(weeklyWorkouts * 3.5 * (todayWorkout?.exercises?.length ?? 4)) : 0}m</Text>
              <Text style={styles.weekStatLabel}>total time</Text>
            </View>
            <View style={styles.weekStatItem}>
              <Text style={styles.weekStatValue}>{streakDays}</Text>
              <Text style={styles.weekStatLabel}>streak</Text>
            </View>
          </View>
          <View style={styles.weekBars}>
            {WEEK_DAYS.map((day, i) => {
              const dayIndex = i === 6 ? 0 : i + 1;
              const isActive = activeDays.includes(dayIndex);
              return (
                <View key={i} style={styles.weekBarCol}>
                  <View style={[styles.weekBar, { height: isActive ? 28 : 8 }, isActive && styles.weekBarActive]} />
                  <Text style={[styles.weekBarDay, isActive && styles.weekBarDayActive]}>{day}</Text>
                </View>
              );
            })}
          </View>
        </Card>

        {/* ── Offline banner ─────────────────────────────────── */}
        {!isConnected && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.offlineText}>You're offline — changes will sync when connected</Text>
          </View>
        )}

        {/* ── Error banner ───────────────────────────────────── */}
        {planFailed && isConnected && (
          <View style={styles.fallbackBanner}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
            <Text style={styles.fallbackText}>Plan generation failed — pull down to retry</Text>
          </View>
        )}

        {/* ── Streak Card ────────────────────────────────────── */}
        <View style={styles.streakHero}>
          <View style={styles.streakHeroTop}>
            <View style={styles.streakHeroLeft}>
              <Ionicons name="flame" size={34} color={colors.streak} />
              <View>
                <Text style={styles.streakNumber}>{streakDays}</Text>
                <Text style={styles.streakLabel}>day streak</Text>
              </View>
            </View>
            {profile?.goals?.primaryGoal ? (
              <View style={styles.streakGoalInfo}>
                <Text style={styles.streakGoalLabel}>GOAL</Text>
                <Text style={styles.streakGoalText} numberOfLines={1}>{profile.goals.primaryGoal}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.weekDotsHero}>
            {WEEK_DAYS.map((day, i) => {
              const dayIndex = i === 6 ? 0 : i + 1;
              const isActive = activeDays.includes(dayIndex);
              return (
                <View key={i} style={styles.dotHeroWrapper}>
                  <View style={[styles.dotHero, isActive && styles.dotHeroActive]} />
                  <Text style={[styles.dotDayLabel, isActive && styles.dotDayLabelActive]}>{day}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Welcome Back Card ────────────────────────────────── */}
        {showWelcomeBack && missedDays >= 1 && (
          <WelcomeBackCard
            missedDays={missedDays}
            onDismiss={() => setShowWelcomeBack(false)}
          />
        )}

        {/* ── Workout Card ─────────────────────────────────────── */}
        <Card onPress={() => navigation.navigate('Workout' as any)}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="barbell-outline" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Workout</Text>
                <Text style={styles.cardSubtitle}>Today's session</Text>
              </View>
            </View>
            {todayWorkout && (
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(todayWorkout.status) + '33' }]}>
                <Text style={[styles.statusText, { color: getStatusColor(todayWorkout.status) }]}>
                  {todayWorkout.status}
                </Text>
              </View>
            )}
          </View>
          {!todayWorkout ? (
            <View style={styles.emptyCard}>
              <Ionicons name="barbell-outline" size={28} color={colors.textMuted} />
              <Text style={styles.emptyCardText}>No workout plan yet</Text>
            </View>
          ) : todayWorkout.isRestDay ? (
            <View style={styles.restDay}>
              <Text style={styles.restDayTitle}>
                {todayWorkout.restDayType === 'active-recovery' ? 'Active Recovery' : 'Rest Day'}
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.workoutStats}>
                <View style={styles.statItem}>
                  <Ionicons name="list-outline" size={14} color={colors.textTertiary} style={{ marginBottom: 4 }} />
                  <Text style={styles.statValueLarge}>{todayWorkout.exercises.length}</Text>
                  <Text style={styles.statLabel}>exercises</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Ionicons name="time-outline" size={14} color={colors.textTertiary} style={{ marginBottom: 4 }} />
                  <Text style={styles.statValueLarge}>{estimateDuration(todayWorkout)}m</Text>
                  <Text style={styles.statLabel}>duration</Text>
                </View>
              </View>
              <View style={styles.muscleGroupBadges}>
                {getMuscleGroupsArray(todayWorkout).map((group) => (
                  <View key={group} style={[styles.muscleGroupBadge, { backgroundColor: getMuscleGroupColor(group) + '22' }]}>
                    <View style={[styles.muscleGroupDot, { backgroundColor: getMuscleGroupColor(group) }]} />
                    <Text style={[styles.muscleGroupBadgeText, { color: getMuscleGroupColor(group) }]}>{group}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </Card>

        {/* ── Nutrition Card ───────────────────────────────────── */}
        <Card onPress={() => navigation.navigate('Nutrition' as any)}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="restaurant-outline" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Nutrition</Text>
                <Text style={styles.cardSubtitle}>Daily targets</Text>
              </View>
            </View>
            {todayMealPlan && (
              <Text style={styles.mealCountBadge}>{todayMealPlan.meals.length} meals</Text>
            )}
          </View>
          {!todayMealPlan ? (
            <View style={styles.emptyCard}>
              <Ionicons name="restaurant-outline" size={28} color={colors.textMuted} />
              <Text style={styles.emptyCardText}>No meal plan yet</Text>
            </View>
          ) : (
            <>
              <View style={styles.nutritionBody}>
                <ProgressRing
                  current={consumedCals}
                  total={todayMealPlan.totalCalories}
                  size={130}
                  strokeWidth={10}
                  label="cal"
                />
                <View style={styles.nutritionRight}>
                  <View style={styles.macroRow}>
                    <View style={[styles.macroDot, { backgroundColor: colors.protein }]} />
                    <Text style={styles.macroLabel}>Protein</Text>
                    <ProgressBar current={consumedCals > 0 ? todayMealPlan.totalProtein * (consumedCals / todayMealPlan.totalCalories) : 0} total={todayMealPlan.totalProtein} color={colors.protein} height={8} style={styles.macroBar} />
                    <Text style={styles.macroValue}>{todayMealPlan.totalProtein}g</Text>
                  </View>
                  <View style={styles.macroRow}>
                    <View style={[styles.macroDot, { backgroundColor: colors.carbs }]} />
                    <Text style={styles.macroLabel}>Carbs</Text>
                    <ProgressBar current={consumedCals > 0 ? todayMealPlan.totalCarbs * (consumedCals / todayMealPlan.totalCalories) : 0} total={todayMealPlan.totalCarbs} color={colors.carbs} height={8} style={styles.macroBar} />
                    <Text style={styles.macroValue}>{todayMealPlan.totalCarbs}g</Text>
                  </View>
                  <View style={styles.macroRow}>
                    <View style={[styles.macroDot, { backgroundColor: colors.fat }]} />
                    <Text style={styles.macroLabel}>Fat</Text>
                    <ProgressBar current={consumedCals > 0 ? todayMealPlan.totalFat * (consumedCals / todayMealPlan.totalCalories) : 0} total={todayMealPlan.totalFat} color={colors.fat} height={8} style={styles.macroBar} />
                    <Text style={styles.macroValue}>{todayMealPlan.totalFat}g</Text>
                  </View>
                </View>
              </View>
              <View style={styles.mealsListDivider} />
              <View style={styles.mealCompactList}>
                {todayMealPlan.meals.map((meal) => (
                  <View key={meal.id} style={styles.mealCompactRow}>
                    <View style={[styles.mealStatusDot, { backgroundColor: getMealFeedbackColor(meal.feedback) }]} />
                    <Text style={styles.mealCompactName} numberOfLines={1}>{meal.name}</Text>
                    <Text style={styles.mealCompactCal}>{meal.calories} cal</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </Card>

        {/* ── Water Card ───────────────────────────────────────── */}
        <Card onPress={() => navigation.navigate('Water')}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="water-outline" size={20} color={colors.water} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Water</Text>
                <Text style={styles.cardSubtitle}>Hydration goal</Text>
              </View>
            </View>
            {waterLog && (
              <Text style={styles.waterSummary}>
                {(waterLog.consumed / 1000).toFixed(1)}L / {(waterLog.goal / 1000).toFixed(1)}L
              </Text>
            )}
          </View>
          {waterLog ? (
            <>
              <ProgressBar
                current={waterLog.consumed}
                total={waterLog.goal}
                color={colors.water}
                height={14}
                style={styles.waterBar}
              />
              <View style={styles.waterButtons}>
                <Pressable style={styles.waterBtn} onPress={() => logWater(250)}>
                  <Ionicons name="water" size={16} color={colors.water} />
                  <Text style={styles.waterBtnText}>+250</Text>
                </Pressable>
                <Pressable style={styles.waterBtn} onPress={() => logWater(500)}>
                  <Ionicons name="water" size={16} color={colors.water} />
                  <Text style={styles.waterBtnText}>+500</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="water-outline" size={28} color={colors.textMuted} />
              <Text style={styles.emptyCardText}>Water tracking loading...</Text>
            </View>
          )}
        </Card>

        {/* ── Quick Actions ────────────────────────────────────── */}
        <View style={styles.quickActions}>
          <Pressable style={styles.quickBtn} onPress={() => navigation.navigate('Coach')}>
            <View style={styles.quickBtnIcon}>
              <Ionicons name="chatbubble-ellipses" size={18} color={colors.primary} />
            </View>
            <Text style={styles.quickBtnText}>Talk to coach</Text>
          </Pressable>
          <Pressable style={styles.quickBtn} onPress={() => navigation.navigate('Nutrition' as any)}>
            <View style={[styles.quickBtnIcon, { backgroundColor: 'rgba(255,152,0,0.15)' }]}>
              <Ionicons name="camera" size={18} color={colors.warning} />
            </View>
            <Text style={styles.quickBtnText}>Snap food</Text>
          </Pressable>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Streak milestone celebration */}
      <StreakMilestoneModal
        visible={showStreakMilestone}
        streakDays={streakDays}
        onDismiss={() => setShowStreakMilestone(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: spacing.screenPadding },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  headerLeft: { flex: 1 },
  date: { color: colors.textSecondary, fontSize: 14, marginTop: 2, fontFamily: fonts.regular, letterSpacing: 0.3 },
  settingsBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  // Stats Summary Bar
  statsSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: spacing.cardMarginBottom,
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.1)',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    fontFamily: fonts.bold,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.3,
  },
  summaryUnit: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    fontFamily: fonts.medium,
  },
  summaryIcon: { marginBottom: 4 },
  summaryTrendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  summaryTrend: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.dotInactive,
  },
  streakValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  // Journey Card
  journeyCard: {
    borderColor: 'rgba(0,212,255,0.15)',
  },
  journeyLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: fonts.bold,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  journeyBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  journeyArcCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  journeyPercent: {
    color: colors.primary,
    fontSize: 26,
    fontWeight: '700',
    fontFamily: fonts.bold,
    letterSpacing: 0.3,
  },
  journeyStats: {
    flex: 1,
    gap: 8,
  },
  journeyStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  journeyStatLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
  },
  journeyStatValue: {
    color: colors.textPrimary,
    fontSize: 15,
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.3,
  },
  journeyDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 2,
  },
  journeyHighlight: {
    color: colors.primary,
    fontSize: 16,
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.3,
  },

  // This Week Summary
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  weekLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: fonts.bold,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  weekStats: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  weekStatItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    paddingVertical: 10,
  },
  weekStatValue: {
    color: colors.textPrimary,
    fontSize: 20,
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.3,
  },
  weekStatLabel: {
    color: colors.textTertiary,
    fontSize: 10,
    fontFamily: fonts.medium,
    letterSpacing: 0.3,
    marginTop: 2,
  },
  weekBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 8,
    height: 52,
  },
  weekBarCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  weekBar: {
    width: '100%',
    borderRadius: 4,
    backgroundColor: colors.dotInactive,
    minHeight: 8,
  },
  weekBarActive: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 3,
  },
  weekBarDay: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: fonts.medium,
    marginTop: 4,
    letterSpacing: 0.3,
  },
  weekBarDayActive: {
    color: colors.primary,
  },

  // Fallback banner
  fallbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.warningDim,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  fallbackText: { color: colors.warning, fontSize: 13, flex: 1, fontFamily: fonts.regular, letterSpacing: 0.3 },

  // Offline banner
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#33333388',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  offlineText: { color: colors.textSecondary, fontSize: 13, flex: 1, fontFamily: fonts.regular, letterSpacing: 0.3 },

  // Streak Hero
  streakHero: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: spacing.cardRadius,
    paddingVertical: 20,
    paddingHorizontal: 24,
    marginBottom: spacing.cardMarginBottom,
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.12)',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 5,
  },
  streakHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  streakHeroLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  streakNumber: {
    color: colors.textPrimary,
    fontSize: 32,
    fontWeight: '700',
    fontFamily: fonts.bold,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.3,
  },
  streakLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: fonts.medium,
    fontWeight: '500',
    letterSpacing: 0.3,
    marginTop: -2,
  },
  streakGoalInfo: {
    alignItems: 'flex-end',
    flexShrink: 1,
    maxWidth: '50%',
  },
  streakGoalLabel: {
    color: colors.textTertiary,
    fontSize: 10,
    fontFamily: fonts.bold,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  streakGoalText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: fonts.medium,
    letterSpacing: 0.3,
  },
  weekDotsHero: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  dotHero: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.dotInactive,
  },
  dotHeroActive: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
    elevation: 4,
  },
  dotHeroWrapper: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  dotDayLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: fonts.medium,
    letterSpacing: 0.3,
  },
  dotDayLabelActive: {
    color: colors.primary,
  },

  // Card header
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  cardTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '600', fontFamily: fonts.semiBold, letterSpacing: 0.3 },
  cardSubtitle: { color: colors.textTertiary, fontSize: 12, fontFamily: fonts.regular, letterSpacing: 0.3, marginTop: 1 },

  // Status badge
  statusBadge: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 10 },
  statusText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize', fontFamily: fonts.semiBold, letterSpacing: 0.5 },

  // Workout
  workoutStats: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  statItem: { flex: 1, alignItems: 'center' },
  statValueLarge: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    fontFamily: fonts.bold,
    paddingHorizontal: 2,
    letterSpacing: 0.3,
  },
  statDivider: { width: 1, height: 34, backgroundColor: colors.dotInactive },
  statLabel: { color: colors.textTertiary, fontSize: 11, fontFamily: fonts.medium, letterSpacing: 0.3, marginTop: 2 },
  muscleGroupBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 2,
  },
  muscleGroupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  muscleGroupDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  muscleGroupBadgeText: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    textTransform: 'capitalize',
    letterSpacing: 0.3,
  },
  restDay: { paddingVertical: 8, alignItems: 'center' },
  restDayTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '600', fontFamily: fonts.semiBold, letterSpacing: 0.3 },

  // Nutrition
  nutritionBody: { flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 16 },
  nutritionRight: { flex: 1, gap: 12 },
  mealCountBadge: { color: colors.textTertiary, fontSize: 12, fontFamily: fonts.medium, letterSpacing: 0.3 },
  macroRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  macroDot: { width: 8, height: 8, borderRadius: 4 },
  macroLabel: { color: colors.textSecondary, fontSize: 11, fontFamily: fonts.medium, width: 46, letterSpacing: 0.3 },
  macroBar: { flex: 1 },
  macroValue: { color: colors.textSecondary, fontSize: 13, width: 38, textAlign: 'right', fontFamily: fonts.semiBold, fontWeight: '600', fontVariant: ['tabular-nums'], letterSpacing: 0.3 },
  mealsListDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 8 },
  mealCompactList: { gap: 2 },
  mealCompactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    gap: 10,
  },
  mealStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  mealCompactName: { color: colors.textPrimary, fontSize: 14, fontFamily: fonts.medium, flex: 1, letterSpacing: 0.3 },
  mealCompactCal: { color: colors.textTertiary, fontSize: 12, fontFamily: fonts.medium, fontVariant: ['tabular-nums'], letterSpacing: 0.3 },

  // Water
  waterSummary: { color: colors.water, fontSize: 15, fontWeight: '700', fontFamily: fonts.bold, letterSpacing: 0.3 },
  waterBar: { marginBottom: 14 },
  waterButtons: { flexDirection: 'row', gap: 10 },
  waterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.waterDim,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 22,
    minHeight: 48,
    borderWidth: 1,
    borderColor: 'rgba(29,233,182,0.2)',
  },
  waterBtnText: { color: colors.water, fontSize: 14, fontWeight: '600', fontFamily: fonts.semiBold, letterSpacing: 0.3 },

  // Quick Actions
  quickActions: { flexDirection: 'row', gap: 12, marginTop: 2 },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 18,
    borderRadius: 14,
    minHeight: 56,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  quickBtnIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.primaryDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickBtnText: { color: colors.textPrimary, fontSize: 14, fontWeight: '600', fontFamily: fonts.semiBold, letterSpacing: 0.3 },

  // Empty state
  emptyCard: { alignItems: 'center', paddingVertical: 18, gap: 6 },
  emptyCardText: { color: colors.textSecondary, fontSize: 14, fontWeight: '500', fontFamily: fonts.medium, letterSpacing: 0.3 },
  emptyCardHint: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.regular, letterSpacing: 0.3 },

  bottomSpacer: { height: 20 },
});
