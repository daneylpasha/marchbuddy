import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRunProgressStore } from '../../store/runProgressStore';
import { colors, fonts, spacing } from '../../theme';
import type { FilterPeriod } from './DataFilterChips';
import { getDateRangeForPeriod } from './DataFilterChips';

interface FilteredStatsCardProps {
  period: FilterPeriod;
}

function formatDuration(minutes: number): string {
  const m = Math.floor(minutes);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

function getPeriodLabel(period: FilterPeriod): string {
  const labels: Record<FilterPeriod, string> = {
    this_week: 'This Week',
    this_month: 'This Month',
    this_quarter: 'This Quarter',
    this_year: 'This Year',
    last_month: 'Last Month',
    last_quarter: 'Last Quarter',
    last_year: 'Last Year',
    all_time: 'All Time',
  };
  return labels[period];
}

export default function FilteredStatsCard({ period }: FilteredStatsCardProps) {
  const sessionHistory = useRunProgressStore((s) => s.sessionHistory);

  const stats = useMemo(() => {
    const { start, end } = getDateRangeForPeriod(period);
    const filtered = (sessionHistory ?? []).filter(
      (s) => s.date >= start && s.date < end,
    );

    const totalSessions = filtered.length;
    const totalMinutes = filtered.reduce((sum, s) => sum + s.durationMinutes, 0);
    const totalDistance = filtered.reduce((sum, s) => sum + s.distanceKm, 0);
    const avgDuration = totalSessions > 0 ? totalMinutes / totalSessions : 0;
    const longestSession = filtered.reduce(
      (max, s) => Math.max(max, s.durationMinutes),
      0,
    );

    return { totalSessions, totalMinutes, totalDistance, avgDuration, longestSession };
  }, [sessionHistory, period]);

  if (period === 'this_week') return null; // Already shown in main chart

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Ionicons name="stats-chart-outline" size={16} color={colors.primary} />
        <Text style={styles.title}>{getPeriodLabel(period)} Stats</Text>
      </View>

      {stats.totalSessions === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No sessions in this period</Text>
        </View>
      ) : (
        <>
          <View style={styles.statsGrid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridValue}>{stats.totalSessions}</Text>
              <Text style={styles.gridLabel}>Sessions</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridValue}>{formatDuration(stats.totalMinutes)}</Text>
              <Text style={styles.gridLabel}>Total Time</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridValue}>{stats.totalDistance.toFixed(1)}</Text>
              <Text style={styles.gridLabel}>km</Text>
            </View>
          </View>

          <View style={styles.secondaryRow}>
            <View style={styles.secondaryItem}>
              <Ionicons name="time-outline" size={14} color={colors.textTertiary} />
              <Text style={styles.secondaryText}>
                Avg {formatDuration(stats.avgDuration)} / session
              </Text>
            </View>
            <View style={styles.secondaryItem}>
              <Ionicons name="trophy-outline" size={14} color={colors.textTertiary} />
              <Text style={styles.secondaryText}>
                Longest: {formatDuration(stats.longestSession)}
              </Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: spacing.cardRadius,
    padding: spacing.cardPadding,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    gap: 16,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  emptyState: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    letterSpacing: 0.2,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gridItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  gridValue: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: colors.textPrimary,
    letterSpacing: 0.3,
    lineHeight: 28,
  },
  gridLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textTertiary,
    letterSpacing: 0.3,
  },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surfaceBorder,
  },
  secondaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  secondaryText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },
});
