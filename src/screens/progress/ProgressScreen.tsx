import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  Easing,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, G } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useRunProgressStore } from '../../store/runProgressStore';
import { useCoachSetupStore } from '../../store/coachSetupStore';
import { useFeedbackStore } from '../../store/feedbackStore';
import { colors, fonts, spacing } from '../../theme';
import type { ProgressStackParamList } from '../../navigation/ProgressNavigator';
import { getWeekStartDate } from '../../utils/sessionUtils';
import DataFilterChips from '../../components/progress/DataFilterChips';
import FilteredStatsCard from '../../components/progress/FilteredStatsCard';
import type { FilterPeriod } from '../../components/progress/DataFilterChips';
import { RatingNudgeCard } from './components/RatingNudgeCard';
import { MILESTONE_CONFIGS } from '../../constants/milestones';

// ─── Ring constants ───────────────────────────────────────────────────────────

const RING_SIZE = 210;
const STROKE = 20;
const GLOW_EXTRA = 8; // glow strokeWidth is STROKE+8, so half of that (4px) bleeds outside
const SVG_PAD = GLOW_EXTRA / 2 + 2; // 6px breathing room on each side
const SVG_SIZE = RING_SIZE + SVG_PAD * 2;
const CX = SVG_SIZE / 2;
const CY = SVG_SIZE / 2;
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;
const SESSIONS_TO_LEVEL_UP = 3;
const MAX_LEVEL = 16;
const BAR_HEIGHT = 80;
const BAR_WIDTH = 28;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getLastSevenDays(): Array<{ date: string; label: string; isToday: boolean }> {
  const result = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayIndex = (d.getDay() + 6) % 7; // Mon=0, Sun=6
    result.push({ date: dateStr, label: DAY_LABELS[dayIndex], isToday: i === 0 });
  }
  return result;
}

function formatDuration(minutes: number): string {
  const m = Math.floor(minutes);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

function formatDate(dateStr: string): string {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ─── Milestone detection ──────────────────────────────────────────────────────

interface UpcomingMilestone {
  type: 'sessions' | 'distance' | 'streak';
  remaining: number;
  targetValue: number;
  icon: string;
  label: string;
}

function getClosestUpcomingMilestone(
  totalSessions: number,
  totalKm: number,
  currentStreak: number,
): UpcomingMilestone | null {
  const sessionMilestones = [10, 25, 50, 100];
  const distanceMilestones = [5, 25, 50, 100];
  const streakMilestones = [7, 14, 30, 60];

  const upcoming: UpcomingMilestone[] = [];

  // Session milestones
  for (const target of sessionMilestones) {
    if (totalSessions < target) {
      upcoming.push({
        type: 'sessions',
        remaining: target - totalSessions,
        targetValue: target,
        icon: 'checkmark-circle',
        label: `${target} Sessions`,
      });
      break;
    }
  }

  // Distance milestones
  for (const target of distanceMilestones) {
    if (totalKm < target) {
      upcoming.push({
        type: 'distance',
        remaining: target - totalKm,
        targetValue: target,
        icon: 'navigate',
        label: `${target}km Total`,
      });
      break;
    }
  }

  // Streak milestones
  for (const target of streakMilestones) {
    if (currentStreak < target) {
      upcoming.push({
        type: 'streak',
        remaining: target - currentStreak,
        targetValue: target,
        icon: 'flame',
        label: `${target}-Day Streak`,
      });
      break;
    }
  }

  if (upcoming.length === 0) return null;

  // Return the milestone with smallest remaining value (closest)
  return upcoming.reduce((closest, current) => {
    return current.remaining < closest.remaining ? current : closest;
  });
}

// ─── Session history badge detection ───────────────────────────────────────────

interface SessionBadge {
  type: 'longest' | 'level_up' | 'comeback';
  label: string;
  emoji: string;
}

function getSessionBadge(
  session: any,
  sessionHistory: any[],
  longestRunMinutes: number,
  previousLevel: number,
): SessionBadge | null {
  // Check if longest duration session
  if (session.durationMinutes === longestRunMinutes && longestRunMinutes > 0) {
    return { type: 'longest', label: 'Longest', emoji: '🏆' };
  }

  // Check if level-up session (heuristic: next session is higher level)
  const sessionIndex = sessionHistory.findIndex(s => s.id === session.id);
  if (sessionIndex > 0) {
    const previousSession = sessionHistory[sessionIndex - 1];
    if (session.planLevel > previousSession.planLevel) {
      return { type: 'level_up', label: 'Level Up', emoji: '📈' };
    }
  }

  // Check if comeback session (3+ days since last session)
  const sessionDate = new Date(session.date);
  if (sessionIndex > 0) {
    const previousSession = sessionHistory[sessionIndex - 1];
    const previousDate = new Date(previousSession.date);
    const daysDiff = Math.floor(
      (sessionDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysDiff >= 3) {
      return { type: 'comeback', label: 'Comeback', emoji: '🔙' };
    }
  }

  return null;
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ProgressScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ProgressStackParamList, 'ProgressMain'>>();
  const { progress, sessionHistory } = useRunProgressStore();
  const { setupData } = useCoachSetupStore();
  const shouldShowRatingNudge = useFeedbackStore((s) => s.shouldShowRatingNudge);

  // Data filter period
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('this_week');

  // Animated streak counter
  const [displayedStreak, setDisplayedStreak] = useState(0);

  // Entrance animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 480,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 480,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animate streak counter
  useEffect(() => {
    const streak = progress?.currentStreakDays ?? 0;
    if (streak === 0) {
      setDisplayedStreak(0);
      return;
    }

    let current = 0;
    const interval = setInterval(() => {
      current += Math.ceil(streak / 10);
      if (current >= streak) {
        setDisplayedStreak(streak);
        clearInterval(interval);
      } else {
        setDisplayedStreak(current);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [progress?.currentStreakDays]);

  // Data
  const userName = setupData.userName || '';
  const totalSessions = progress?.totalSessionsCompleted ?? 0;
  const currentLevel = progress?.currentLevel ?? 1;
  const streak = progress?.currentStreakDays ?? 0;
  const bestStreak = progress?.bestStreakDays ?? 0;
  const totalKm = progress?.totalDistanceKm ?? 0;
  const longestRunMinutes = progress?.longestRunMinutes ?? 0;
  const sessionsAtLevel = progress?.sessionsAtCurrentLevel ?? 0;
  const sessionsThisWeek = progress?.sessionsThisWeek ?? 0;
  const minutesThisWeek = progress?.minutesThisWeek ?? 0;
  const isMaxLevel = currentLevel >= MAX_LEVEL;

  // Ring
  const levelProgress = isMaxLevel ? 1 : Math.min(sessionsAtLevel / SESSIONS_TO_LEVEL_UP, 1);
  const strokeDashoffset = CIRC * (1 - levelProgress);

  // Weekly chart
  const weekDays = getLastSevenDays();
  const sessionsByDate = (sessionHistory ?? []).reduce<Record<string, number>>((acc, s) => {
    acc[s.date] = (acc[s.date] || 0) + s.durationMinutes;
    return acc;
  }, {});
  const maxMinutes = Math.max(20, ...weekDays.map(d => sessionsByDate[d.date] || 0));

  // Recent sessions (most recent first)
  const recentSessions = [...(sessionHistory ?? [])].reverse().slice(0, 15);

  // Upcoming milestone
  const upcomingMilestone = getClosestUpcomingMilestone(totalSessions, totalKm, streak);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* ── Header ──────────────────────────────────────────────────── */}
          <View style={styles.header}>
            <Text style={styles.headerLabel}>YOUR JOURNEY</Text>
            <Text style={styles.headerTitle}>{userName || 'Progress'}</Text>
          </View>

          {/* ── Rating Nudge ─────────────────────────────────────────────── */}
          {shouldShowRatingNudge(totalSessions, setupData.completedAt ?? null) && (
            <RatingNudgeCard totalSessions={totalSessions} />
          )}

          {totalSessions === 0 ? (
            /* ── First-visit welcome card (replaces empty zeros) ──────── */
            <View style={styles.welcomeCard}>
              <Text style={styles.welcomeEmoji}>👟</Text>
              <Text style={styles.welcomeTitle}>Your Journey Starts Here</Text>
              <Text style={styles.welcomeSubtitle}>
                Complete your first session and this page will come alive with streaks, levels, milestones, and stats.
              </Text>
              <View style={styles.welcomeHintRow}>
                <View style={styles.welcomeHint}>
                  <Ionicons name="flame-outline" size={18} color={colors.streak} />
                  <Text style={styles.welcomeHintText}>Build streaks</Text>
                </View>
                <View style={styles.welcomeHint}>
                  <Ionicons name="trending-up-outline" size={18} color={colors.primary} />
                  <Text style={styles.welcomeHintText}>Level up</Text>
                </View>
                <View style={styles.welcomeHint}>
                  <Ionicons name="trophy-outline" size={18} color="#FBBF24" />
                  <Text style={styles.welcomeHintText}>Earn milestones</Text>
                </View>
              </View>
            </View>
          ) : (
            <>
              {/* ── HERO: Streak Display ────────────────────────────────────── */}
              <View style={styles.heroStreakSection}>
                <View style={styles.heroStreakTop}>
                  <Text style={styles.heroFlame}>🔥</Text>
                  <Text style={styles.heroStreakValue}>{displayedStreak}</Text>
                  <Text style={styles.heroStreakLabel}>DAY STREAK</Text>
                </View>
                {bestStreak > 0 && (
                  <Text style={styles.heroBestStreak}>Your best: {bestStreak} days</Text>
                )}
              </View>

              {/* ── Level Ring (smaller, still tappable) ──────────────────── */}
              <TouchableOpacity
                style={styles.levelRingSection}
                onPress={() => navigation.navigate('JourneyMap')}
                activeOpacity={0.85}
              >
                <View style={{ width: SVG_SIZE * 0.75, height: SVG_SIZE * 0.75 }}>
                  <Svg width={SVG_SIZE * 0.75} height={SVG_SIZE * 0.75}>
                    <G transform={`rotate(-90, ${CX * 0.75}, ${CY * 0.75})`}>
                      {/* Track */}
                      <Circle
                        cx={CX * 0.75}
                        cy={CY * 0.75}
                        r={RADIUS * 0.75}
                        stroke="rgba(255,255,255,0.07)"
                        strokeWidth={STROKE * 0.75}
                        fill="none"
                      />
                      {/* Inner glow ring */}
                      <Circle
                        cx={CX * 0.75}
                        cy={CY * 0.75}
                        r={RADIUS * 0.75}
                        stroke={colors.primaryGlow}
                        strokeWidth={(STROKE + GLOW_EXTRA) * 0.75}
                        fill="none"
                        strokeDasharray={CIRC * 0.75}
                        strokeDashoffset={strokeDashoffset * 0.75}
                        strokeLinecap="round"
                      />
                      {/* Progress arc */}
                      <Circle
                        cx={CX * 0.75}
                        cy={CY * 0.75}
                        r={RADIUS * 0.75}
                        stroke={colors.primary}
                        strokeWidth={STROKE * 0.75}
                        fill="none"
                        strokeDasharray={CIRC * 0.75}
                        strokeDashoffset={strokeDashoffset * 0.75}
                        strokeLinecap="round"
                      />
                    </G>
                  </Svg>

                  {/* Center text */}
                  <View style={[StyleSheet.absoluteFill, styles.ringCenter]}>
                    <Text style={styles.ringLevel}>L{currentLevel}</Text>
                    <Text style={styles.ringLevelLabel}>LEVEL</Text>
                    {!isMaxLevel && (
                      <Text style={styles.ringSessions}>
                        {sessionsAtLevel}/{SESSIONS_TO_LEVEL_UP}
                      </Text>
                    )}
                  </View>
                </View>

                <Text style={styles.ringCaption}>
                  {isMaxLevel
                    ? '🏆 Programme Complete!'
                    : `${SESSIONS_TO_LEVEL_UP - sessionsAtLevel} more to Level ${currentLevel + 1}`}
                </Text>
                <View style={styles.viewJourneyRow}>
                  <Text style={styles.viewJourneyText}>View full journey</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                </View>
              </TouchableOpacity>

              {/* ── Stats row ───────────────────────────────────────────────── */}
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{totalSessions}</Text>
                  <Text style={styles.statLabel}>Sessions</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{totalKm.toFixed(1)}</Text>
                  <Text style={styles.statLabel}>Total km</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{bestStreak}</Text>
                  <Text style={styles.statLabel}>Best Streak</Text>
                </View>
              </View>
            </>
          )}

          {/* ── Weekly bar chart (tappable → WeekDetail) ────────────────── */}
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('WeekDetail', { weekStartDate: getWeekStartDate() })}
          >
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>This Week</Text>
              <View style={styles.cardHeaderRight}>
                <Text style={styles.cardMeta}>
                  {sessionsThisWeek} sessions · {Math.round(minutesThisWeek)}m
                </Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
              </View>
            </View>

            <View style={styles.barChart}>
              {weekDays.map(({ date, label, isToday }) => {
                const minutes = sessionsByDate[date] || 0;
                const barH = minutes > 0 ? Math.max(6, Math.round((minutes / maxMinutes) * BAR_HEIGHT)) : 0;
                const hasActivity = minutes > 0;
                return (
                  <View key={date} style={styles.barColumn}>
                    <View style={styles.barArea}>
                      {hasActivity ? (
                        <View style={styles.barTrack}>
                          <View
                            style={[
                              styles.barFill,
                              { height: barH },
                              isToday && styles.barFillToday,
                            ]}
                          />
                        </View>
                      ) : (
                        <View style={[styles.barDot, isToday && styles.barDotToday]} />
                      )}
                    </View>
                    <Text style={[styles.barLabel, isToday && styles.barLabelToday]}>{label}</Text>
                    {hasActivity && (
                      <Text style={styles.barMinutes}>{Math.round(minutes)}m</Text>
                    )}
                  </View>
                );
              })}
            </View>
          </TouchableOpacity>

          {/* ── Data Filters ─────────────────────────────────────────────── */}
          <View style={styles.filterSection}>
            <DataFilterChips selected={filterPeriod} onSelect={setFilterPeriod} />
          </View>
          <FilteredStatsCard period={filterPeriod} />

          {/* ── Next Milestone Teaser ───────────────────────────────────── */}
          {upcomingMilestone && (
            <View style={styles.milestoneTeaser}>
              <View style={styles.milestoneTeaserContent}>
                <Text style={styles.milestoneTeaserText}>
                  {upcomingMilestone.remaining} more {
                    upcomingMilestone.type === 'sessions' ? 'sessions' :
                    upcomingMilestone.type === 'distance' ? 'km' :
                    'days'
                  } to reach
                </Text>
                <View style={styles.milestoneTeaserBadge}>
                  <Text style={styles.milestoneTeaserEmoji}>
                    {upcomingMilestone.type === 'sessions' && '🏅'}
                    {upcomingMilestone.type === 'distance' && '🗺️'}
                    {upcomingMilestone.type === 'streak' && '🔥'}
                  </Text>
                  <Text style={styles.milestoneTeaserLabel}>
                    {upcomingMilestone.targetValue}
                    {upcomingMilestone.type === 'distance' ? 'km' :
                     upcomingMilestone.type === 'streak' ? '-day' : ''}{' '}
                    {upcomingMilestone.type === 'sessions' && 'Sessions'}
                    {upcomingMilestone.type === 'distance' && 'Total'}
                    {upcomingMilestone.type === 'streak' && 'Streak'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* ── Session history ──────────────────────────────────────────── */}
          <View style={styles.historySection}>
            <Text style={styles.sectionLabel}>RECENT SESSIONS</Text>

            {recentSessions.length === 0 ? (
              <View style={styles.emptyHistory}>
                <Ionicons name="walk-outline" size={36} color={colors.textMuted} />
                <Text style={styles.emptyHistoryText}>
                  Complete your first session to see your history here
                </Text>
              </View>
            ) : (
              recentSessions.map((session, i) => {
                const badge = getSessionBadge(session, recentSessions, longestRunMinutes, currentLevel);
                return (
                  <View key={`${session.id}-${i}`} style={styles.historyItem}>
                    <View style={styles.historyLevelBadge}>
                      <Text style={styles.historyLevelText}>L{session.planLevel}</Text>
                    </View>
                    <View style={styles.historyInfo}>
                      <Text style={styles.historyTitle} numberOfLines={1}>{session.planTitle}</Text>
                      <Text style={styles.historyDate}>{formatDate(session.date)}</Text>
                    </View>
                    <View style={styles.historyRight}>
                      <View style={styles.historyDurationBadgeRow}>
                        <Text style={styles.historyDuration}>{formatDuration(session.durationMinutes)}</Text>
                        {badge && (
                          <View style={styles.sessionBadge}>
                            <Text style={styles.sessionBadgeEmoji}>{badge.emoji}</Text>
                            <Text style={styles.sessionBadgeLabel}>{badge.label}</Text>
                          </View>
                        )}
                      </View>
                      {session.distanceKm > 0 && (
                        <Text style={styles.historyDistance}>{session.distanceKm.toFixed(2)} km</Text>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>

        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 52,
  },

  // Header
  header: {
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.primary,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 34,
    color: colors.textPrimary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Welcome card for first-time users
  welcomeCard: {
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: spacing.cardRadius,
    padding: 32,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    gap: 12,
  },
  welcomeEmoji: {
    fontSize: 48,
    marginBottom: 4,
  },
  welcomeTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 20,
    color: colors.textPrimary,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 280,
  },
  welcomeHintRow: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 8,
  },
  welcomeHint: {
    alignItems: 'center',
    gap: 6,
  },
  welcomeHintText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textTertiary,
    letterSpacing: 0.2,
  },

  // Hero streak section
  heroStreakSection: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 8,
    marginBottom: 16,
    backgroundColor: colors.surfaceElevated,
    borderRadius: spacing.cardRadius,
    borderWidth: 1,
    borderColor: colors.streak + '30',
  },
  heroStreakTop: {
    alignItems: 'center',
    gap: 0,
  },
  heroFlame: {
    fontSize: 48,
    marginBottom: 8,
  },
  heroStreakValue: {
    fontFamily: fonts.titleRegular,
    fontSize: 64,
    color: colors.streak,
    letterSpacing: 1,
    lineHeight: 66,
  },
  heroStreakLabel: {
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 2.2,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  heroBestStreak: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textTertiary,
    letterSpacing: 0.3,
  },

  // Level ring section (smaller)
  levelRingSection: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
    marginBottom: 14,
  },
  ringCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  ringLevel: {
    fontFamily: fonts.titleRegular,
    fontSize: 56,
    color: colors.primaryBright,
    letterSpacing: 1,
    lineHeight: 58,
  },
  ringLevelLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 2.2,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  ringSessions: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 0.3,
    marginTop: 4,
  },
  ringCaption: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
  viewJourneyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  viewJourneyText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.primary,
    letterSpacing: 0.3,
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: spacing.cardRadius,
    paddingVertical: 18,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    marginBottom: 14,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  statValue: {
    fontFamily: fonts.bold,
    fontSize: 26,
    color: colors.textPrimary,
    letterSpacing: 0.3,
    lineHeight: 30,
  },
  statLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textTertiary,
    letterSpacing: 0.3,
  },
  flameIcon: { marginBottom: 2, marginLeft: 2 },
  statDivider: {
    width: 1,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },

  // Card
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: spacing.cardRadius,
    padding: spacing.cardPadding,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    gap: 18,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardMeta: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },

  // Bar chart
  barChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  barArea: {
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  barTrack: {
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  barFillToday: {
    backgroundColor: colors.primaryBright,
  },
  barDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  barDotToday: {
    backgroundColor: colors.primary,
    opacity: 0.5,
  },
  barLabel: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.textTertiary,
    letterSpacing: 0.3,
  },
  barLabelToday: {
    color: colors.primary,
  },
  barMinutes: {
    fontFamily: fonts.regular,
    fontSize: 9,
    color: colors.textTertiary,
    letterSpacing: 0.2,
  },

  // Filter section
  filterSection: {
    marginBottom: 14,
    marginHorizontal: -spacing.screenPadding,
    paddingHorizontal: spacing.screenPadding,
  },

  // Milestone teaser
  milestoneTeaser: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: spacing.cardRadius,
    paddingVertical: 14,
    paddingHorizontal: spacing.cardPadding,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  milestoneTeaserContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    justifyContent: 'space-between',
  },
  milestoneTeaserText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textSecondary,
    letterSpacing: 0.3,
    flex: 1,
  },
  milestoneTeaserBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryDim,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  milestoneTeaserEmoji: {
    fontSize: 16,
  },
  milestoneTeaserLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.primary,
    letterSpacing: 0.2,
  },

  // History
  historySection: {
    gap: 10,
  },
  sectionLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    gap: 12,
  },
  historyLevelBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.primaryDim,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyLevelText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.primary,
    letterSpacing: 0.5,
  },
  historyInfo: {
    flex: 1,
    gap: 3,
  },
  historyTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  historyDate: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },
  historyRight: {
    alignItems: 'flex-end',
    gap: 3,
  },
  historyDurationBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyDuration: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  sessionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryDim,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sessionBadgeEmoji: {
    fontSize: 12,
  },
  sessionBadgeLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
    color: colors.primary,
    letterSpacing: 0.2,
  },
  historyDistance: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },

  // Empty history
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: 36,
    gap: 12,
  },
  emptyHistoryText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: 21,
    letterSpacing: 0.2,
  },
});
