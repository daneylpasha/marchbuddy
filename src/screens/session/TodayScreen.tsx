import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCoachSetupStore } from '../../store/coachSetupStore';
import { useRunProgressStore } from '../../store/runProgressStore';
import { useSessionStore } from '../../store/sessionStore';
import { sessionApi } from '../../services/sessionApi';
import { SessionPlan } from '../../types/session';
import { RecommendedSessionCard } from './components/RecommendedSessionCard';
import { AlternativeSessionCard } from './components/AlternativeSessionCard';
import { colors, fonts, spacing } from '../../theme';
import { FeatureTips } from '../../components/FeatureTips';
import type { RunStackParamList } from '../../navigation/RunNavigator';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type TodayScreenNavProp = NativeStackNavigationProp<RunStackParamList, 'Today'>;

interface Props {
  navigation: TodayScreenNavProp;
}

const TARGET_SESSIONS_PER_WEEK = 3;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function TodayScreen({ navigation }: Props) {
  const { setupData, guestId } = useCoachSetupStore();
  const { progress, initializeProgress, declareRestDay, isPerfectWeek, markPerfectWeekCelebrated, restDayDeclaredDate } = useRunProgressStore();
  const {
    todayOptions,
    isLoadingOptions,
    setTodayOptions,
    setSelectedPlan,
    setLoadingOptions,
    planAdjustment,
    clearPlanAdjustment,
  } = useSessionStore();

  const hasFetchedRef = useRef(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadOptions = useCallback(
    async (force = false) => {
      const userId = guestId ?? useRunProgressStore.getState().progress?.userId;
      if (!userId) return;
      initializeProgress(userId);
      const currentProgress = useRunProgressStore.getState().progress;
      if (!currentProgress) return;
      if (!force && todayOptions) return;

      setLoadingOptions(true);
      setLoadError(null);
      try {
        const options = await sessionApi.generateTodayOptions({
          progress: currentProgress,
          onboardingData: {
            userName: setupData.userName,
            triggerStatement: setupData.triggerStatement,
            anchorPerson: setupData.anchorPerson,
            primaryFear: setupData.primaryFear,
            successVision: setupData.successVision,
          },
        });
        setTodayOptions(options);
        setLoadError(null);
      } catch (error) {
        console.error('Failed to load session options:', error);
        setLoadError('We had trouble building your session. This usually fixes itself — try again.');
        setLoadingOptions(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [guestId, setupData, todayOptions],
  );

  useFocusEffect(
    useCallback(() => {
      if (!hasFetchedRef.current || !todayOptions) {
        hasFetchedRef.current = true;
        loadOptions();
      }
    }, [loadOptions, todayOptions]),
  );

  const handleSelectPlan = (plan: SessionPlan) => {
    setSelectedPlan(plan);
    navigation.navigate('SessionDetail');
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    hasFetchedRef.current = false;
    await loadOptions(true);
    setIsRefreshing(false);
  }, [loadOptions]);

  const toggleAlternatives = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowAlternatives((prev) => !prev);
  };

  const currentLevel = progress?.currentLevel ?? 1;
  const sessionsThisWeek = progress?.sessionsThisWeek ?? 0;
  const streak = progress?.currentStreakDays ?? 0;
  const greeting = setupData.userName
    ? `${getTimeGreeting()}, ${setupData.userName}`
    : getTimeGreeting();

  // Coach-adjusted plan logic
  const isRestDay = planAdjustment?.suggestedVariant === 'rest';
  const adjustedPlan =
    planAdjustment && !isRestDay && todayOptions
      ? (todayOptions.alternatives.find((a) => a.variant === planAdjustment.suggestedVariant) ?? null)
      : null;
  const effectiveRecommended = adjustedPlan ?? todayOptions?.recommended ?? null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerContext}>
            <Text style={styles.levelBadge}>LEVEL {currentLevel}</Text>
            {sessionsThisWeek > 0 && (
              <>
                <View style={styles.headerDot} />
                <Text style={styles.headerMeta}>
                  Day {sessionsThisWeek} of {TARGET_SESSIONS_PER_WEEK}
                </Text>
              </>
            )}
          </View>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate('Settings')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="settings-outline" size={22} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle}>{greeting}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Feature tips for first-time users */}
        <FeatureTips />

        {isLoadingOptions && !isRefreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Building your session...</Text>
          </View>
        ) : todayOptions ? (
          <>
            {/* Plan adjustment banner */}
            {planAdjustment && (
              <TouchableOpacity
                style={styles.adjustmentBanner}
                onPress={clearPlanAdjustment}
                activeOpacity={0.7}
              >
                <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                <Text style={styles.adjustmentBannerText}>
                  {isRestDay
                    ? 'Coach gave you a rest day — tap to undo'
                    : adjustedPlan
                      ? `Plan adjusted to ${adjustedPlan.title} — tap to undo`
                      : 'Plan adjusted by coach — tap to undo'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Rest day state */}
            {isRestDay ? (
              <View style={styles.restDayCard}>
                <Text style={styles.restDayEmoji}>🛌</Text>
                <Text style={styles.restDayTitle}>Rest Day</Text>
                <Text style={styles.restDaySubtitle}>
                  Your coach cleared your session today. Recovery is part of the training.
                </Text>
              </View>
            ) : (
              <>
                {/* Hero session card — takes center stage */}
                {effectiveRecommended && (
                  <RecommendedSessionCard
                    plan={effectiveRecommended}
                    onPress={() => handleSelectPlan(effectiveRecommended)}
                  />
                )}

                {/* Inline coach message — subtle, below the hero card */}
                {todayOptions.coachMessage ? (
                  <View style={styles.coachInline}>
                    <Ionicons name="chatbubble" size={14} color={colors.primary} />
                    <Text style={styles.coachInlineText}>
                      {todayOptions.coachMessage}
                    </Text>
                  </View>
                ) : null}

                {/* Streak nudge */}
                {streak > 0 && (
                  <View style={styles.streakNudge}>
                    <Ionicons name="flame" size={16} color={colors.streak} />
                    <Text style={styles.streakNudgeText}>
                      {streak} day streak — keep it alive!
                    </Text>
                  </View>
                )}

                {/* Alternatives — collapsed by default behind "Not feeling it?" */}
                {todayOptions.alternatives.filter(
                  (a) => a.variant !== planAdjustment?.suggestedVariant,
                ).length > 0 && (
                  <View style={styles.alternativesSection}>
                    <Pressable
                      onPress={toggleAlternatives}
                      style={styles.alternativesToggle}
                    >
                      <Text style={styles.alternativesToggleText}>
                        {showAlternatives ? 'Hide options' : 'Not feeling it? See other options'}
                      </Text>
                      <Ionicons
                        name={showAlternatives ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={colors.textTertiary}
                      />
                    </Pressable>

                    {showAlternatives && (
                      <View style={styles.alternativesRow}>
                        {todayOptions.alternatives
                          .filter((a) => a.variant !== planAdjustment?.suggestedVariant)
                          .map((alt) => (
                            <AlternativeSessionCard
                              key={alt.id}
                              plan={alt}
                              onPress={() => handleSelectPlan(alt)}
                            />
                          ))}
                      </View>
                    )}
                  </View>
                )}
              </>
            )}

            {/* Minimal week progress — dots + label */}
            {progress && (
              <View style={styles.weekDots}>
                {Array.from({ length: TARGET_SESSIONS_PER_WEEK }, (_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.weekDot,
                      i < sessionsThisWeek ? styles.weekDotFilled : styles.weekDotEmpty,
                    ]}
                  />
                ))}
                <Text style={styles.weekDotsLabel}>
                  {sessionsThisWeek >= TARGET_SESSIONS_PER_WEEK
                    ? 'Week complete!'
                    : `${sessionsThisWeek} of ${TARGET_SESSIONS_PER_WEEK} this week`}
                </Text>
              </View>
            )}

            {/* Perfect Week celebration */}
            {isPerfectWeek() && (
              <Pressable
                style={styles.perfectWeekCard}
                onPress={markPerfectWeekCelebrated}
              >
                <Text style={styles.perfectWeekEmoji}>🏅</Text>
                <View style={styles.perfectWeekContent}>
                  <Text style={styles.perfectWeekTitle}>Perfect Week!</Text>
                  <Text style={styles.perfectWeekSub}>
                    You hit all {TARGET_SESSIONS_PER_WEEK} sessions. Incredible consistency.
                  </Text>
                </View>
              </Pressable>
            )}

            {/* Rest day — saves streak without breaking it */}
            {!isRestDay && streak > 0 && restDayDeclaredDate !== new Date().toISOString().split('T')[0] && (
              <Pressable
                style={styles.restDayButton}
                onPress={declareRestDay}
              >
                <Ionicons name="bed-outline" size={16} color={colors.textTertiary} />
                <Text style={styles.restDayButtonText}>
                  Taking a rest day? Your streak is safe.
                </Text>
              </Pressable>
            )}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons
              name={loadError ? 'cloud-offline-outline' : 'refresh-circle-outline'}
              size={48}
              color={colors.textMuted}
            />
            <Text style={styles.emptyStateTitle}>
              {loadError ? 'Connection hiccup' : "Couldn't load today's session"}
            </Text>
            {loadError && (
              <Text style={styles.emptyStateDetail}>{loadError}</Text>
            )}
            <TouchableOpacity onPress={handleRefresh} style={styles.retryButton}>
              <Ionicons name="refresh-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: spacing.screenPadding,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  headerContext: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  levelBadge: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  headerDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.textTertiary,
    marginHorizontal: 8,
  },
  headerMeta: {
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 0.3,
    color: colors.textTertiary,
  },
  settingsButton: {
    padding: 2,
  },
  headerTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 28,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  scrollContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 40,
    gap: 16,
  },

  // Loading & empty states
  loadingContainer: {
    paddingTop: 80,
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textSecondary,
  },
  emptyState: {
    paddingTop: 80,
    alignItems: 'center',
    gap: 14,
  },
  emptyStateTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 17,
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  emptyStateDetail: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingVertical: 10,
    paddingHorizontal: 28,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  retryButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.primary,
    letterSpacing: 0.3,
  },

  // Plan adjustment banner
  adjustmentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primaryDim,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.25)',
  },
  adjustmentBannerText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.primary,
    flex: 1,
  },

  // Rest day
  restDayCard: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  restDayEmoji: {
    fontSize: 48,
  },
  restDayTitle: {
    fontFamily: fonts.titleRegular,
    fontSize: 28,
    color: colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  restDaySubtitle: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },

  // Coach inline message (replaces separate CoachMessageCard)
  coachInline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 4,
  },
  coachInlineText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 21,
    color: colors.textSecondary,
  },

  // Streak nudge
  streakNudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  streakNudgeText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.streak,
    letterSpacing: 0.2,
  },

  // Alternatives — collapsible section
  alternativesSection: {
    gap: 12,
  },
  alternativesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  alternativesToggleText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textTertiary,
  },
  alternativesRow: {
    flexDirection: 'row',
    gap: 12,
  },

  // Minimal week dots
  weekDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 8,
  },
  weekDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  weekDotFilled: {
    backgroundColor: colors.primary,
  },
  weekDotEmpty: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  weekDotsLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textTertiary,
    marginLeft: 4,
  },

  // Perfect Week celebration
  perfectWeekCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.primaryDim,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  perfectWeekEmoji: {
    fontSize: 32,
  },
  perfectWeekContent: {
    flex: 1,
    gap: 4,
  },
  perfectWeekTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.primary,
    letterSpacing: 0.3,
  },
  perfectWeekSub: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  // Rest day button
  restDayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  restDayButtonText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textTertiary,
  },
});
