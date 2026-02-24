import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CompletedSession } from '../../../types/session';
import { formatDuration, formatPace } from '../../../utils/sessionUtils';
import { colors, fonts } from '../../../theme';

interface SessionSummaryCardProps {
  session: CompletedSession;
}

export const SessionSummaryCard: React.FC<SessionSummaryCardProps> = ({ session }) => {
  const durationSeconds = session.actualDurationMinutes * 60;

  return (
    <View style={styles.container}>
      {/* Main stats */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatDuration(durationSeconds)}</Text>
          <Text style={styles.statLabel}>Duration</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.stat}>
          <Text style={styles.statValue}>{session.actualDistanceKm.toFixed(2)}</Text>
          <Text style={styles.statLabel}>km</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatPace(session.pacePerKm)}</Text>
          <Text style={styles.statLabel}>/km</Text>
        </View>
      </View>

      {/* Plan info row */}
      <View style={styles.infoRow}>
        <Text style={styles.planTitle}>{session.planTitle}</Text>
        {session.endedEarly && (
          <View style={styles.earlyBadge}>
            <Text style={styles.earlyBadgeText}>Ended early</Text>
          </View>
        )}
      </View>

      {/* Segments */}
      <Text style={styles.segmentsText}>
        {session.completedSegments} of {session.plannedSegments.length} segments completed
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 20,
    padding: 24,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: fonts.bold,
    fontSize: 26,
    color: '#fff',
    letterSpacing: 0.3,
  },
  statLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.divider,
    marginVertical: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 8,
  },
  planTitle: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textPrimary,
  },
  earlyBadge: {
    backgroundColor: colors.warningDim,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  earlyBadgeText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.warning,
  },
  segmentsText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
