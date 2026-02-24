import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatDurationMinutes } from '../../../utils/sessionUtils';
import { colors, fonts } from '../../../theme';

interface WeekProgressBarProps {
  sessionsThisWeek: number;
  targetSessions: number;
  minutesThisWeek: number;
}

export const WeekProgressBar: React.FC<WeekProgressBarProps> = ({
  sessionsThisWeek,
  targetSessions,
  minutesThisWeek,
}) => {
  const goalReached = sessionsThisWeek >= targetSessions;
  const bonus = sessionsThisWeek - targetSessions;
  const dots = Array.from({ length: targetSessions }, () => true);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>THIS WEEK</Text>
        {goalReached && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>✓ GOAL COMPLETE</Text>
          </View>
        )}
      </View>

      <View style={styles.dotsRow}>
        {goalReached ? (
          dots.map((_, i) => (
            <View key={i} style={[styles.dot, styles.dotFilled]} />
          ))
        ) : (
          Array.from({ length: targetSessions }, (_, i) => (
            <View key={i} style={[styles.dot, i < sessionsThisWeek ? styles.dotFilled : styles.dotEmpty]} />
          ))
        )}
      </View>

      <Text style={styles.stats}>
        {goalReached
          ? `${targetSessions} sessions done${bonus > 0 ? ` · +${bonus} bonus` : ''}${minutesThisWeek > 0 ? ` · ${formatDurationMinutes(minutesThisWeek)} total` : ''}`
          : `${sessionsThisWeek} of ${targetSessions} sessions${minutesThisWeek > 0 ? ` · ${formatDurationMinutes(minutesThisWeek)} total` : ''}`
        }
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  badge: {
    backgroundColor: colors.primaryDim,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  dotFilled: { backgroundColor: colors.primary },
  dotEmpty:  { backgroundColor: colors.divider },
  stats: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },
});
