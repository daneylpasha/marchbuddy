import React, { useEffect, useRef } from 'react';
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
import { RatingNudgeCard } from './components/RatingNudgeCard';

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

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ProgressScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ProgressStackParamList, 'ProgressMain'>>();
  const { progress, sessionHistory } = useRunProgressStore();
  const { setupData } = useCoachSetupStore();
  const shouldShowRatingNudge = useFeedbackStore((s) => s.shouldShowRatingNudge);

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

  // Data
  const userName = setupData.userName || '';
  const totalSessions = progress?.totalSessionsCompleted ?? 0;
  const currentLevel = progress?.currentLevel ?? 1;
  const streak = progress?.currentStreakDays ?? 0;
  const bestStreak = progress?.bestStreakDays ?? 0;
  const totalKm = progress?.totalDistanceKm ?? 0;
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

          {/* ── Level Ring ──────────────────────────────────────────────── */}
          <TouchableOpacity
            style={styles.ringSection}
            onPress={() => navigation.navigate('JourneyMap')}
            activeOpacity={0.85}
          >
            <View style={{ width: SVG_SIZE, height: SVG_SIZE }}>
              <Svg width={SVG_SIZE} height={SVG_SIZE}>
                <G transform={`rotate(-90, ${CX}, ${CY})`}>
                  {/* Track */}
                  <Circle
                    cx={CX}
                    cy={CY}
                    r={RADIUS}
                    stroke="rgba(255,255,255,0.07)"
                    strokeWidth={STROKE}
                    fill="none"
                  />
                  {/* Inner glow ring */}
                  <Circle
                    cx={CX}
                    cy={CY}
                    r={RADIUS}
                    stroke={colors.primaryGlow}
                    strokeWidth={STROKE + GLOW_EXTRA}
                    fill="none"
                    strokeDasharray={CIRC}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                  />
                  {/* Progress arc */}
                  <Circle
                    cx={CX}
                    cy={CY}
                    r={RADIUS}
                    stroke={colors.primary}
                    strokeWidth={STROKE}
                    fill="none"
                    strokeDasharray={CIRC}
                    strokeDashoffset={strokeDashoffset}
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
                    {sessionsAtLevel}/{SESSIONS_TO_LEVEL_UP} sessions
                  </Text>
                )}
              </View>
            </View>

            <Text style={styles.ringCaption}>
              {isMaxLevel
                ? '🏆 Programme Complete!'
                : `${SESSIONS_TO_LEVEL_UP - sessionsAtLevel} more to reach Level ${currentLevel + 1}`}
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
              <View style={styles.statValueRow}>
                <Text style={styles.statValue}>{streak}</Text>
                <Ionicons name="flame" size={18} color={colors.streak} style={styles.flameIcon} />
              </View>
              <Text style={styles.statLabel}>Day Streak</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{totalKm.toFixed(1)}</Text>
              <Text style={styles.statLabel}>Total km</Text>
            </View>
          </View>

          {/* ── Weekly bar chart ─────────────────────────────────────────── */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>This Week</Text>
              <Text style={styles.cardMeta}>
                {sessionsThisWeek} sessions · {Math.round(minutesThisWeek)}m
              </Text>
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
          </View>

          {/* ── Best streak card ─────────────────────────────────────────── */}
          {bestStreak > 0 && (
            <View style={styles.streakCard}>
              <View style={styles.streakLeft}>
                <Text style={styles.streakEmoji}>🔥</Text>
                <View>
                  <Text style={styles.streakTitle}>Best Streak</Text>
                  <Text style={styles.streakSub}>Personal record</Text>
                </View>
              </View>
              <Text style={styles.streakValue}>{bestStreak} days</Text>
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
              recentSessions.map((session, i) => (
                <View key={`${session.id}-${i}`} style={styles.historyItem}>
                  <View style={styles.historyLevelBadge}>
                    <Text style={styles.historyLevelText}>L{session.planLevel}</Text>
                  </View>
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyTitle} numberOfLines={1}>{session.planTitle}</Text>
                    <Text style={styles.historyDate}>{formatDate(session.date)}</Text>
                  </View>
                  <View style={styles.historyRight}>
                    <Text style={styles.historyDuration}>{formatDuration(session.durationMinutes)}</Text>
                    {session.distanceKm > 0 && (
                      <Text style={styles.historyDistance}>{session.distanceKm.toFixed(2)} km</Text>
                    )}
                  </View>
                </View>
              ))
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
    fontFamily: fonts.titleRegular,
    fontSize: 34,
    color: colors.textPrimary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Ring section
  ringSection: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  ringCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  ringLevel: {
    fontFamily: fonts.titleRegular,
    fontSize: 78,
    color: colors.primaryBright,
    letterSpacing: 1,
    lineHeight: 80,
  },
  ringLevelLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 2.5,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  ringSessions: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textSecondary,
    letterSpacing: 0.3,
    marginTop: 6,
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

  // Streak card
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    borderRadius: spacing.cardRadius,
    paddingVertical: 16,
    paddingHorizontal: spacing.cardPadding,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  streakLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  streakEmoji: { fontSize: 28 },
  streakTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  streakSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    letterSpacing: 0.2,
    marginTop: 2,
  },
  streakValue: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: colors.streak,
    letterSpacing: 0.3,
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
  historyDuration: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textPrimary,
    letterSpacing: 0.3,
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
