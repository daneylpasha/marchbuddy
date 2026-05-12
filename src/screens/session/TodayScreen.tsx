import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { ProBanner } from '../../components/upgrade/ProBanner';
import { analytics, EVENTS } from '../../services/analytics';
import { useSessionStore } from '../../store/sessionStore';
import { useScheduleStore } from '../../store/scheduleStore';
import { useNotificationStore } from '../../store/notificationStore';
import { sessionApi } from '../../services/sessionApi';
import { SessionPlan } from '../../types/session';
import { RecommendedSessionCard } from './components/RecommendedSessionCard';
import { AlternativeSessionCard } from './components/AlternativeSessionCard';
import ScheduleSheet, { type ScheduleSheetRef } from '../../components/schedule/ScheduleSheet';
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
  const TARGET_SESSIONS_PER_WEEK = setupData.weeklyFrequency ?? 3;
  const {
    progress,
    initializeProgress,
    declareRestDay,
    isPerfectWeek,
    markPerfectWeekCelebrated,
    restDayDeclaredDate,
  } = useRunProgressStore();
  const {
    todayOptions,
    isLoadingOptions,
    setTodayOptions,
    setSelectedPlan,
    setLoadingOptions,
    planAdjustment,
    clearPlanAdjustment,
  } = useSessionStore();

  const getScheduleForSession = useScheduleStore((s) => s.getScheduleForSession);
  const scheduleSheetRef = useRef<ScheduleSheetRef>(null);

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
        const recentSessionSignals = await sessionApi.getRecentSessionSignals();
        const options = await sessionApi.generateTodayOptions({
          progress: currentProgress,
          onboardingData: {
            userName: setupData.userName,
            triggerStatement: setupData.triggerStatement,
            anchorPerson: setupData.anchorPerson,
            primaryFear: setupData.primaryFear,
            successVision: setupData.successVision,
          },
          recentSessionSignals,
        });
        setTodayOptions(options);
        setLoadError(null);
      } catch (error) {
        console.error('Failed to load session options:', error);
        setLoadError(
          'We had trouble building your session. This usually fixes itself — try again.',
        );
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

  // ── Notification deep-link ──────────────────────────────────────────
  //
  // When the user taps a session reminder, the notification listener
  // records {sessionKey, type} in notificationStore. If today's options
  // include that plan, auto-open its detail screen — otherwise we stay
  // on Today. Either way the tap is consumed so we don't re-trigger
  // on the next focus.
  const lastNotificationTap = useNotificationStore((s) => s.lastNotificationTap);
  const clearNotificationTap = useNotificationStore((s) => s.clearNotificationTap);
  useEffect(() => {
    const tapKey = lastNotificationTap?.sessionKey;
    if (!tapKey || !todayOptions) return;

    // Only honour taps within the last 2 minutes — avoids re-firing
    // the deep-link on every mount long after the user interacted.
    const ts = lastNotificationTap?.timestamp ?? 0;
    if (Date.now() - ts > 2 * 60 * 1000) {
      clearNotificationTap();
      return;
    }

    const match =
      (todayOptions.recommended?.id === tapKey ? todayOptions.recommended : null) ??
      todayOptions.alternatives.find((a) => a.id === tapKey) ??
      null;

    if (match) {
      setSelectedPlan(match);
      navigation.navigate('SessionDetail');
    }
    clearNotificationTap();
  }, [lastNotificationTap, todayOptions, setSelectedPlan, navigation, clearNotificationTap]);

  const openSchedule = (plan: SessionPlan) => {
    const existing = getScheduleForSession(plan.id);
    scheduleSheetRef.current?.present(plan.id, plan.title, existing);
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

  const { setStartingLevel, isLevelLocked, isOnLastFreeLevel, openPaywall, tier } =
    useSubscriptionStore();
  const isFree = tier === 'free';

  const currentLevel = progress?.currentLevel ?? 1;
  const sessionsThisWeek = progress?.sessionsThisWeek ?? 0;
  const streak = progress?.currentStreakDays ?? 0;

  // Capture starting level once — idempotent, only fires on first call
  React.useEffect(() => {
    if (progress?.currentLevel) {
      setStartingLevel(progress.currentLevel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress?.currentLevel]);

  const levelLocked = isLevelLocked(currentLevel);
  const onLastFreeLevel = isOnLastFreeLevel(currentLevel);

  // Fire a level_locked_view event once per (user, level) pair. The same
  // user landing on the same locked level repeatedly shouldn't inflate the
  // funnel — use a ref to dedupe within this screen mount.
  const lastLoggedLockedLevelRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (levelLocked && currentLevel !== lastLoggedLockedLevelRef.current) {
      lastLoggedLockedLevelRef.current = currentLevel;
      analytics.track(EVENTS.level_locked_view, { level: currentLevel });
    }
  }, [levelLocked, currentLevel]);
  const greeting = setupData.userName
    ? `${getTimeGreeting()}, ${setupData.userName}`
    : getTimeGreeting();

  // Coach-adjusted plan logic
  const isRestDay = planAdjustment?.suggestedVariant === 'rest';
  const adjustedPlan =
    planAdjustment && !isRestDay && todayOptions
      ? (todayOptions.alternatives.find((a) => a.variant === planAdjustment.suggestedVariant) ??
        null)
      : null;
  const effectiveRecommended = adjustedPlan ?? todayOptions?.recommended ?? null;

  // Soften the CTA when the user is "done for now" — either they
  // already logged a session today, or they've already hit the weekly
  // target. In both cases, pushing another workout is bad UX.
  const todayStr = new Date().toISOString().split('T')[0];
  const completedToday =
    !!progress?.lastSessionDate &&
    progress.lastSessionDate === todayStr &&
    restDayDeclaredDate !== todayStr;
  const weekTargetHit = sessionsThisWeek >= TARGET_SESSIONS_PER_WEEK;
  const alreadyDoneToday = completedToday || weekTargetHit;

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
          <View style={styles.headerActions}>
            {isFree && (
              <TouchableOpacity
                style={styles.freeChip}
                onPress={() => openPaywall('header_chip_today')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="flash" size={11} color={colors.primary} />
                <Text style={styles.freeChipText}>Free</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => navigation.navigate('Settings')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="settings-outline" size={22} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
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

            {/* Level locked — replace session cards with upgrade gate */}
            {levelLocked ? (
              <View style={styles.lockedCard}>
                <View style={styles.lockedIconRing}>
                  <Ionicons name="lock-closed" size={32} color={colors.primary} />
                </View>
                <Text style={styles.lockedTitle}>LEVEL {currentLevel}</Text>
                <Text style={styles.lockedHeadline}>This is Pro territory</Text>
                <Text style={styles.lockedBody}>
                  You've completed your free levels and built a real habit. Level {currentLevel} is
                  where the real running begins — and it's waiting for you.
                </Text>
                <TouchableOpacity
                  style={styles.lockedCta}
                  onPress={() => openPaywall('today_locked')}
                  activeOpacity={0.85}
                >
                  <Ionicons name="flash" size={16} color="#fff" />
                  <Text style={styles.lockedCtaText}>Unlock with MarchBuddy Pro</Text>
                </TouchableOpacity>
                <Text style={styles.lockedPricing}>
                  $4.99/month · $35/year · Founding member price
                </Text>
              </View>
            ) : null}

            {/* Rest day state */}
            {!levelLocked && isRestDay ? (
              <View style={styles.restDayCard}>
                <Text style={styles.restDayEmoji}>🛌</Text>
                <Text style={styles.restDayTitle}>Rest Day</Text>
                <Text style={styles.restDaySubtitle}>
                  Your coach cleared your session today. Recovery is part of the training.
                </Text>
              </View>
            ) : !levelLocked ? (
              <>
                {(() => {
                  const coachBlock = todayOptions.coachMessage ? (
                    <View style={alreadyDoneToday ? styles.coachHero : styles.coachInline}>
                      <Ionicons
                        name="chatbubble"
                        size={alreadyDoneToday ? 16 : 14}
                        color={colors.primary}
                      />
                      <Text
                        style={alreadyDoneToday ? styles.coachHeroText : styles.coachInlineText}
                      >
                        {todayOptions.coachMessage
                          .split(/(\*\*[^*]+\*\*)/g)
                          .map((part: string, i: number) =>
                            part.startsWith('**') && part.endsWith('**') ? (
                              <Text key={i} style={{ fontFamily: fonts.bold, fontStyle: 'normal' }}>
                                {part.slice(2, -2)}
                              </Text>
                            ) : (
                              part
                            ),
                          )}
                      </Text>
                    </View>
                  ) : null;

                  const streakBlock =
                    streak > 0 ? (
                      <View style={styles.streakNudge}>
                        <Ionicons name="flame" size={16} color={colors.streak} />
                        <Text style={styles.streakNudgeText}>
                          {streak} day streak — keep it alive!
                        </Text>
                      </View>
                    ) : null;

                  const cardBlock = effectiveRecommended ? (
                    <RecommendedSessionCard
                      plan={effectiveRecommended}
                      onPress={() => handleSelectPlan(effectiveRecommended)}
                      onSchedule={() => openSchedule(effectiveRecommended)}
                      isScheduled={!!getScheduleForSession(effectiveRecommended.id)}
                      subdued={alreadyDoneToday}
                    />
                  ) : null;

                  const scheduledBadgeBlock =
                    effectiveRecommended && getScheduleForSession(effectiveRecommended.id)
                      ? (() => {
                          const sched = getScheduleForSession(effectiveRecommended.id)!;
                          const dt = new Date(sched.scheduled_at);
                          const isToday = dt.toDateString() === new Date().toDateString();
                          const hours = dt.getHours();
                          const mins = dt.getMinutes().toString().padStart(2, '0');
                          const ampm = hours >= 12 ? 'PM' : 'AM';
                          const displayHour = hours % 12 || 12;
                          const timeStr = `${displayHour}:${mins} ${ampm}`;
                          return (
                            <View style={styles.scheduledBadge}>
                              <Ionicons name="calendar" size={14} color={colors.primary} />
                              <Text style={styles.scheduledBadgeText}>
                                {isToday
                                  ? `Scheduled for today at ${timeStr}`
                                  : `Scheduled for ${timeStr}`}
                              </Text>
                            </View>
                          );
                        })()
                      : null;

                  // When today is already done, lead with rest message +
                  // streak; the workout card drops below in subdued mode.
                  if (alreadyDoneToday) {
                    return (
                      <>
                        {coachBlock}
                        {streakBlock}
                        {cardBlock}
                        {scheduledBadgeBlock}
                      </>
                    );
                  }

                  return (
                    <>
                      {cardBlock}
                      {scheduledBadgeBlock}
                      {coachBlock}
                      {streakBlock}
                    </>
                  );
                })()}

                {/* Alternatives — collapsed by default behind "Not feeling it?" */}
                {todayOptions.alternatives.filter(
                  (a) => a.variant !== planAdjustment?.suggestedVariant,
                ).length > 0 && (
                  <View style={styles.alternativesSection}>
                    <Pressable onPress={toggleAlternatives} style={styles.alternativesToggle}>
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

                {/* "Next level is Pro" teaser — shown on last free level */}
                {onLastFreeLevel && (
                  <ProBanner
                    variant="next_level"
                    nextLevel={currentLevel + 1}
                    onPress={() => openPaywall('level_locked_next')}
                  />
                )}
              </>
            ) : null}

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
            {isPerfectWeek(TARGET_SESSIONS_PER_WEEK) && (
              <Pressable style={styles.perfectWeekCard} onPress={markPerfectWeekCelebrated}>
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
            {!isRestDay &&
              streak > 0 &&
              restDayDeclaredDate !== new Date().toISOString().split('T')[0] && (
                <Pressable
                  style={styles.restDayButton}
                  onPress={() => {
                    declareRestDay();
                    // Push updated progress to server so the rest-day-saved
                    // streak survives sign-out → sign-in.
                    const { authService } = require('../../services/authService');
                    authService.pushRunProgress().catch(() => {});
                  }}
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
            {loadError && <Text style={styles.emptyStateDetail}>{loadError}</Text>}
            <TouchableOpacity onPress={handleRefresh} style={styles.retryButton}>
              <Ionicons
                name="refresh-outline"
                size={16}
                color={colors.primary}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <ScheduleSheet ref={scheduleSheetRef} />
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  freeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16,185,129,0.14)',
    borderColor: 'rgba(16,185,129,0.3)',
    borderWidth: 0.5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  freeChipText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.primary,
    letterSpacing: 0.6,
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

  // Scheduled badge
  scheduledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  scheduledBadgeText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.primary,
    letterSpacing: 0.2,
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
  // Hero coach message — used when today's session is already done so
  // the rest recommendation leads instead of the workout CTA.
  coachHero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.primaryDim,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.25)',
  },
  coachHeroText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textPrimary,
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

  // Level locked gate
  lockedCard: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 8,
    gap: 14,
  },
  lockedIconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryDim,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  lockedTitle: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  lockedHeadline: {
    fontFamily: fonts.titleRegular,
    fontSize: 36,
    color: colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
  },
  lockedBody: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 23,
    letterSpacing: 0.2,
    maxWidth: 300,
  },
  lockedCta: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    marginTop: 4,
  },
  lockedCtaText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: '#fff',
    letterSpacing: 0.3,
  },
  lockedPricing: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 0.2,
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
