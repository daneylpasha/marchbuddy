import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../theme';

interface ConsistencyCalendarProps {
  /** Set of ISO date strings (YYYY-MM-DD) where user completed a workout */
  activeDates: Set<string>;
  /** Current streak count */
  currentStreak: number;
  /** Longest streak ever */
  longestStreak: number;
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getMonthGrid(year: number, month: number): (number | null)[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  // getDay() returns 0=Sun..6=Sat, we want 0=Mon..6=Sun
  const startOffset = (firstDay.getDay() + 6) % 7;

  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = Array(startOffset).fill(null);

  for (let day = 1; day <= daysInMonth; day++) {
    week.push(day);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  return weeks;
}

export default function ConsistencyCalendar({ activeDates, currentStreak, longestStreak }: ConsistencyCalendarProps) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const todayDate = now.getDate();
  const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const weeks = getMonthGrid(year, month);

  // Count active days this month
  const activeDaysThisMonth = Array.from(activeDates).filter((d) => {
    const parts = d.split('-');
    return parseInt(parts[0]) === year && parseInt(parts[1]) === month + 1;
  }).length;

  return (
    <View style={styles.container}>
      {/* Month header */}
      <Text style={styles.monthTitle}>{monthName}</Text>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{currentStreak}</Text>
          <Text style={styles.statLabel}>Current</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{longestStreak}</Text>
          <Text style={styles.statLabel}>Longest</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{activeDaysThisMonth}</Text>
          <Text style={styles.statLabel}>This Month</Text>
        </View>
      </View>

      {/* Weekday headers */}
      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label) => (
          <Text key={label} style={styles.weekdayLabel}>{label}</Text>
        ))}
      </View>

      {/* Calendar grid */}
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((day, di) => {
            if (day === null) {
              return <View key={di} style={styles.dayCell} />;
            }
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isActive = activeDates.has(dateStr);
            const isToday = day === todayDate;
            const isFuture = day > todayDate;

            return (
              <View
                key={di}
                style={[
                  styles.dayCell,
                  isActive && styles.dayCellActive,
                  isToday && !isActive && styles.dayCellToday,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    isActive && styles.dayTextActive,
                    isFuture && styles.dayTextFuture,
                    isToday && styles.dayTextToday,
                  ]}
                >
                  {day}
                </Text>
              </View>
            );
          })}
        </View>
      ))}

      {/* Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
          <Text style={styles.legendText}>Workout done</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary }]} />
          <Text style={styles.legendText}>Today</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  monthTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    letterSpacing: 0.3,
    marginBottom: 14,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingVertical: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    fontFamily: fonts.bold,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: colors.textTertiary,
    fontSize: 11,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.dotInactive,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
    fontFamily: fonts.medium,
    letterSpacing: 0.3,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    maxHeight: 38,
  },
  dayCellActive: {
    backgroundColor: colors.successDim,
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  dayText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    fontFamily: fonts.medium,
  },
  dayTextActive: {
    color: colors.success,
    fontWeight: '700',
    fontFamily: fonts.bold,
  },
  dayTextFuture: {
    color: colors.textMuted,
  },
  dayTextToday: {
    color: colors.primary,
    fontWeight: '700',
    fontFamily: fonts.bold,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: colors.textTertiary,
    fontSize: 11,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
  },
});
