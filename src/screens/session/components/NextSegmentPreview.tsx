import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SessionSegment } from '../../../types/session';
import { formatDuration, getSegmentTypeName } from '../../../utils/sessionUtils';
import { colors, fonts } from '../../../theme';

interface NextSegmentPreviewProps {
  // Current segment progress (0–1) — shown as a bar at the top of the card.
  progress: number;
  progressColor: string;
  // The upcoming segment. Null on the final segment (no "next" to show).
  segment: SessionSegment | null;
}

export const NextSegmentPreview: React.FC<NextSegmentPreviewProps> = ({
  progress,
  progressColor,
  segment,
}) => {
  const isRunning = segment?.type === 'run';

  return (
    <View style={styles.container}>
      {/* Current segment progress */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${Math.round(progress * 100)}%`,
              backgroundColor: progressColor,
            },
          ]}
        />
      </View>

      {segment ? (
        <>
          <View style={styles.divider} />
          <Text style={styles.label}>NEXT UP</Text>
          <View style={styles.content}>
            <View style={[styles.bar, isRunning ? styles.barRun : styles.barWalk]} />
            <Text style={styles.segmentType} numberOfLines={1}>
              {getSegmentTypeName(segment.type)}
            </Text>
            <Text style={styles.duration}>{formatDuration(segment.durationSeconds)}</Text>
          </View>
        </>
      ) : (
        <>
          <View style={styles.divider} />
          <Text style={styles.finalLabel}>FINAL SEGMENT</Text>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 12,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.textTertiary,
    marginBottom: 8,
  },
  finalLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.primary,
    textAlign: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bar: {
    width: 4,
    height: 22,
    borderRadius: 2,
    marginRight: 14,
  },
  barWalk: { backgroundColor: colors.textTertiary },
  barRun: { backgroundColor: colors.primary },
  segmentType: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: '#fff',
    flex: 1,
  },
  duration: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.textSecondary,
  },
});
