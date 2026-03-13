import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useRunProgressStore } from '../../store/runProgressStore';
import { colors, fonts, spacing } from '../../theme';
import type { ProgressStackParamList } from '../../navigation/ProgressNavigator';

type NavProp = NativeStackNavigationProp<ProgressStackParamList, 'WeekDetail'>;
type RouteType = RouteProp<ProgressStackParamList, 'WeekDetail'>;

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const BAR_HEIGHT = 100;
const BAR_WIDTH = 32;

function formatDuration(minutes: number): string {
  const m = Math.floor(minutes);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

function getWeekDays(weekStartDate: string): Array<{ date: string; label: string; isToday: boolean }> {
  const result = [];
  const start = new Date(weekStartDate + 'T00:00:00');
  const todayStr = new Date().toISOString().split('T')[0];

  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    result.push({ date: dateStr, label: DAY_LABELS[i], isToday: dateStr === todayStr });
  }
  return result;
}

function formatWeekRange(weekStartDate: string): string {
  const start = new Date(weekStartDate + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', opts)} — ${end.toLocaleDateString('en-US', opts)}`;
}

export default function WeekDetailScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();
  const { weekStartDate } = route.params;
  const { sessionHistory } = useRunProgressStore();

  const weekDays = useMemo(() => getWeekDays(weekStartDate), [weekStartDate]);

  // Filter sessions to this week
  const weekSessions = useMemo(() => {
    const weekEnd = new Date(weekStartDate + 'T00:00:00');
    weekEnd.setDate(weekEnd.getDate() + 7);
    const endStr = weekEnd.toISOString().split('T')[0];

    return (sessionHistory ?? []).filter(
      (s) => s.date >= weekStartDate && s.date < endStr,
    );
  }, [sessionHistory, weekStartDate]);

  // Stats
  const totalSessions = weekSessions.length;
  const totalMinutes = weekSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const totalDistance = weekSessions.reduce((sum, s) => sum + s.distanceKm, 0);
  const avgDuration = totalSessions > 0 ? totalMinutes / totalSessions : 0;

  // By-day breakdown
  const sessionsByDate = weekSessions.reduce<Record<string, number>>((acc, s) => {
    acc[s.date] = (acc[s.date] || 0) + s.durationMinutes;
    return acc;
  }, {});
  const maxMinutes = Math.max(20, ...weekDays.map((d) => sessionsByDate[d.date] || 0));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerLabel}>WEEK INSIGHTS</Text>
          <Text style={styles.headerTitle}>{formatWeekRange(weekStartDate)}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalSessions}</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatDuration(totalMinutes)}</Text>
            <Text style={styles.statLabel}>Total Time</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalDistance.toFixed(1)}</Text>
            <Text style={styles.statLabel}>km</Text>
          </View>
        </View>

        {/* Daily Bar Chart */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Daily Breakdown</Text>
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

        {/* Average Stats */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Averages</Text>
          <View style={styles.avgRow}>
            <View style={styles.avgItem}>
              <Ionicons name="time-outline" size={20} color={colors.primary} />
              <Text style={styles.avgValue}>{formatDuration(avgDuration)}</Text>
              <Text style={styles.avgLabel}>per session</Text>
            </View>
            <View style={styles.avgItem}>
              <Ionicons name="navigate-outline" size={20} color={colors.primary} />
              <Text style={styles.avgValue}>
                {totalSessions > 0 ? (totalDistance / totalSessions).toFixed(1) : '0'}km
              </Text>
              <Text style={styles.avgLabel}>per session</Text>
            </View>
          </View>
        </View>

        {/* Session List */}
        <View style={styles.sessionSection}>
          <Text style={styles.sectionLabel}>SESSIONS THIS WEEK</Text>

          {weekSessions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={36} color={colors.textMuted} />
              <Text style={styles.emptyText}>No sessions this week</Text>
            </View>
          ) : (
            [...weekSessions].reverse().map((session, i) => (
              <View key={`${session.id}-${i}`} style={styles.sessionItem}>
                <View style={styles.sessionLevelBadge}>
                  <Text style={styles.sessionLevelText}>L{session.planLevel}</Text>
                </View>
                <View style={styles.sessionInfo}>
                  <Text style={styles.sessionTitle} numberOfLines={1}>{session.planTitle}</Text>
                  <Text style={styles.sessionDate}>
                    {new Date(session.date + 'T00:00:00').toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                </View>
                <View style={styles.sessionRight}>
                  <Text style={styles.sessionDuration}>{formatDuration(session.durationMinutes)}</Text>
                  {session.distanceKm > 0 && (
                    <Text style={styles.sessionDistance}>{session.distanceKm.toFixed(2)} km</Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  backButton: {
    padding: 4,
  },
  headerCenter: {
    alignItems: 'center',
    gap: 2,
  },
  headerLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  headerSpacer: {
    width: 36,
  },
  scrollContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 20,
    paddingBottom: 52,
  },

  // Stats
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
  statValue: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: colors.textPrimary,
    letterSpacing: 0.3,
    lineHeight: 28,
  },
  statLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textTertiary,
    letterSpacing: 0.3,
  },
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
  cardTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: colors.textPrimary,
    letterSpacing: 0.3,
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
    fontSize: 11,
    color: colors.textTertiary,
    letterSpacing: 0.3,
  },
  barLabelToday: {
    color: colors.primary,
  },
  barMinutes: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.textTertiary,
    letterSpacing: 0.2,
  },

  // Averages
  avgRow: {
    flexDirection: 'row',
    gap: 16,
  },
  avgItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.primaryDim,
    borderRadius: 14,
    paddingVertical: 16,
    gap: 6,
  },
  avgValue: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  avgLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },

  // Sessions
  sessionSection: {
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: 36,
    gap: 12,
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    gap: 12,
  },
  sessionLevelBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.primaryDim,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionLevelText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.primary,
    letterSpacing: 0.5,
  },
  sessionInfo: {
    flex: 1,
    gap: 3,
  },
  sessionTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  sessionDate: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },
  sessionRight: {
    alignItems: 'flex-end',
    gap: 3,
  },
  sessionDuration: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  sessionDistance: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },
});
