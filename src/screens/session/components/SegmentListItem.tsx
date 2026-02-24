import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SessionSegment } from '../../../types/session';
import { formatDuration, getSegmentTypeName } from '../../../utils/sessionUtils';
import { colors, fonts } from '../../../theme';

interface SegmentListItemProps {
  segment: SessionSegment;
  index: number;
  isLast: boolean;
}

export const SegmentListItem: React.FC<SegmentListItemProps> = ({ segment, isLast }) => {
  const isRunning = segment.type === 'run';

  return (
    <View style={[styles.container, !isLast && styles.withBorder]}>
      <View style={[styles.typeBar, isRunning ? styles.typeBarRun : styles.typeBarWalk]} />
      <View style={styles.content}>
        <View style={styles.mainRow}>
          <Text style={[styles.typeName, isRunning && styles.typeNameRun]}>
            {getSegmentTypeName(segment.type)}
          </Text>
          <Text style={styles.duration}>{formatDuration(segment.durationSeconds)}</Text>
        </View>
        <Text style={styles.label}>{segment.label}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  withBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  typeBar: {
    width: 3,
    borderRadius: 2,
    marginRight: 16,
    alignSelf: 'stretch',
  },
  typeBarWalk: { backgroundColor: colors.textTertiary },
  typeBarRun:  { backgroundColor: colors.primary },
  content: { flex: 1 },
  mainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  typeName: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  typeNameRun: { color: colors.primary },
  duration: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textSecondary,
  },
  label: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textTertiary,
  },
});
