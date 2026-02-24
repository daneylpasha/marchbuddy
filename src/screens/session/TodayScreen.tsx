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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCoachSetupStore } from '../../store/coachSetupStore';
import { useRunProgressStore } from '../../store/runProgressStore';
import { useSessionStore } from '../../store/sessionStore';
import { useChatStore } from '../../store/chatStore';
import { sessionApi } from '../../services/sessionApi';
import { SessionPlan } from '../../types/session';
import { CoachMessageCard } from './components/CoachMessageCard';
import { RecommendedSessionCard } from './components/RecommendedSessionCard';
import { AlternativeSessionCard } from './components/AlternativeSessionCard';
import { WeekProgressBar } from './components/WeekProgressBar';
import { colors, fonts, spacing } from '../../theme';
import type { RunStackParamList } from '../../navigation/RunNavigator';

type TodayScreenNavProp = NativeStackNavigationProp<RunStackParamList, 'Today'>;

interface Props {
  navigation: TodayScreenNavProp;
}

const TARGET_SESSIONS_PER_WEEK = 3;


export default function TodayScreen({ navigation }: Props) {
  const { setupData, guestId } = useCoachSetupStore();
  const { progress, initializeProgress } = useRunProgressStore();
  const hasUnread = useChatStore((state) => state.hasUnread);
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

  const loadOptions = useCallback(
    async (force = false) => {
      // Use guest ID (generated at onboarding completion, persisted)
      const userId = guestId ?? useRunProgressStore.getState().progress?.userId;
      if (!userId) return;

      // Initialize progress for this user (no-op if already initialized)
      initializeProgress(userId);

      // Read latest progress directly from store (sync update)
      const currentProgress = useRunProgressStore.getState().progress;
      if (!currentProgress) return;

      // Don't re-fetch unless forced or no options cached
      if (!force && todayOptions) return;

      setLoadingOptions(true);
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
      } catch (error) {
        console.error('Failed to load session options:', error);
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

  const currentLevel = progress?.currentLevel ?? 1;
  const greeting = setupData.userName ? `Hey, ${setupData.userName}` : "Today's Run";

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
          <Text style={styles.headerLabel}>LEVEL {currentLevel}</Text>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate('Settings')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
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

            {/* Coach message */}
            <CoachMessageCard message={todayOptions.coachMessage} />

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
                {/* Recommended (or adjusted) session */}
                {effectiveRecommended && (
                  <View style={styles.section}>
                    <RecommendedSessionCard
                      plan={effectiveRecommended}
                      onPress={() => handleSelectPlan(effectiveRecommended)}
                    />
                  </View>
                )}

                {/* Alternative options — hide the one that's now featured */}
                {todayOptions.alternatives.filter(
                  (a) => a.variant !== planAdjustment?.suggestedVariant,
                ).length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>OTHER OPTIONS</Text>
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
                  </View>
                )}
              </>
            )}

            {/* Week progress */}
            {progress && (
              <View style={styles.section}>
                <WeekProgressBar
                  sessionsThisWeek={progress.sessionsThisWeek}
                  targetSessions={TARGET_SESSIONS_PER_WEEK}
                  minutesThisWeek={progress.minutesThisWeek}
                />
              </View>
            )}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="refresh-circle-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyStateText}>Couldn't load today's session</Text>
            <TouchableOpacity onPress={handleRefresh} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Coach chat FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CoachChat')}
        activeOpacity={0.8}
      >
        <Ionicons name="chatbubble-ellipses" size={24} color="#FFFFFF" />
        {hasUnread && <View style={styles.fabBadge} />}
      </TouchableOpacity>
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
    paddingBottom: 20,
    paddingHorizontal: spacing.screenPadding,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  settingsButton: {
    padding: 2,
  },
  headerLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontFamily: fonts.titleRegular,
    fontSize: 34,
    color: colors.textPrimary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  scrollContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 40,
    gap: 16,
  },
  loadingContainer: {
    paddingTop: 80,
    alignItems: 'center',
    gap: 16,
  },
  emptyState: {
    paddingTop: 80,
    alignItems: 'center',
    gap: 14,
  },
  emptyStateText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textSecondary,
  },
  retryButton: {
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
  loadingText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textSecondary,
  },
  section: {},
  sectionLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  alternativesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  adjustmentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(6,138,21,0.1)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(6,138,21,0.25)',
  },
  adjustmentBannerText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.primary,
    flex: 1,
  },
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
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  fabBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.primary,
  },
});
