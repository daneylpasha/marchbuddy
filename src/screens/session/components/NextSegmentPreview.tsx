import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SessionSegment } from '../../../types/session';
import { formatDuration, getSegmentTypeName } from '../../../utils/sessionUtils';
import { colors, fonts } from '../../../theme';

interface NextSegmentPreviewProps {
  segment: SessionSegment;
}

export const NextSegmentPreview: React.FC<NextSegmentPreviewProps> = ({ segment }) => {
  const isRunning = segment.type === 'run';

  return (
    <View style={styles.container}>
      <Text style={styles.label}>NEXT UP</Text>
      <View style={styles.content}>
        <View style={[styles.bar, isRunning ? styles.barRun : styles.barWalk]} />
        <Text style={styles.segmentType}>{getSegmentTypeName(segment.type)}</Text>
        <Text style={styles.duration}>{formatDuration(segment.durationSeconds)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    padding: 16,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.textTertiary,
    marginBottom: 8,
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
  barRun:  { backgroundColor: colors.primary },
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
