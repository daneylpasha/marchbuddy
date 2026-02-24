import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SessionSegment } from '../../../types/session';
import { formatDuration, getSegmentTypeName } from '../../../utils/sessionUtils';
import { colors, fonts } from '../../../theme';

interface CurrentSegmentDisplayProps {
  segment: SessionSegment;
  remainingSeconds: number;
  progress: number; // 0–1
  isPaused: boolean;
}

export const CurrentSegmentDisplay: React.FC<CurrentSegmentDisplayProps> = ({
  segment,
  remainingSeconds,
  progress,
  isPaused,
}) => {
  const isRunning = segment.type === 'run';
  const segmentColor = isRunning ? colors.primary : '#fff';

  return (
    <View style={styles.container}>
      {/* Segment type label */}
      <Text style={[styles.segmentType, { color: segmentColor }]}>
        {getSegmentTypeName(segment.type).toUpperCase()}
      </Text>

      {/* Countdown */}
      <Text style={[styles.remainingTime, isPaused && styles.paused]}>
        {formatDuration(remainingSeconds)}
      </Text>

      <Text style={styles.remainingLabel}>remaining</Text>

      {/* Pace guidance */}
      <Text style={styles.guidance}>"{segment.label}"</Text>

      {/* Segment progress bar */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${Math.round(progress * 100)}%`,
              backgroundColor: segmentColor,
            },
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
  },
  segmentType: {
    fontFamily: fonts.titleRegular,
    fontSize: 52,
    letterSpacing: 4,
    marginBottom: 4,
  },
  remainingTime: {
    fontFamily: fonts.bold,
    fontSize: 80,
    color: '#fff',
    letterSpacing: 2,
  },
  paused: {
    opacity: 0.45,
  },
  remainingLabel: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textTertiary,
    marginTop: 2,
    marginBottom: 18,
    letterSpacing: 0.3,
  },
  guidance: {
    fontFamily: fonts.medium,
    fontSize: 17,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 28,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  progressTrack: {
    width: '100%',
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
});
