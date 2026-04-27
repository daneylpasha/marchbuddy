import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { SessionSegment } from '../../../types/session';
import { formatDuration, getSegmentTypeName } from '../../../utils/sessionUtils';
import { colors, fonts } from '../../../theme';

interface CurrentSegmentDisplayProps {
  segment: SessionSegment;
  remainingSeconds: number;
  isPaused: boolean;
}

export const CurrentSegmentDisplay: React.FC<CurrentSegmentDisplayProps> = ({
  segment,
  remainingSeconds,
  isPaused,
}) => {
  const isRunning = segment.type === 'run';
  const segmentColor = isRunning ? colors.primary : '#fff';

  const { height } = useWindowDimensions();
  // Three tiers — widened from earlier version because phones in the
  // 720–800px range were still showing layout overflow.
  const isShort = height < 800;
  const isVeryShort = height < 700;

  const segmentTypeSize = isVeryShort ? 34 : isShort ? 42 : 52;
  // Tighter letter-spacing on smaller phones so words like "WARMUP"
  // (6 wide chars × 4px tracking = 24px extra width) don't clip.
  const segmentTypeSpacing = isShort ? 2 : 4;
  const remainingTimeSize = isVeryShort ? 56 : isShort ? 66 : 80;
  // Symmetric gap above and below "remaining" — the countdown uses
  // lineHeight === fontSize so its glyph has no built-in bottom padding.
  const labelGap = isVeryShort ? 10 : isShort ? 14 : 18;
  const guidanceSize = isShort ? 15 : 17;

  return (
    <View style={styles.container}>
      {/* Segment type label */}
      <Text
        style={[
          styles.segmentType,
          {
            color: segmentColor,
            fontSize: segmentTypeSize,
            letterSpacing: segmentTypeSpacing,
          },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {getSegmentTypeName(segment.type).toUpperCase()}
      </Text>

      {/* Countdown */}
      <Text
        style={[
          styles.remainingTime,
          { fontSize: remainingTimeSize, lineHeight: remainingTimeSize },
          isPaused && styles.paused,
        ]}
        numberOfLines={1}
      >
        {formatDuration(remainingSeconds)}
      </Text>

      <Text
        style={[
          styles.remainingLabel,
          { marginTop: labelGap, marginBottom: labelGap },
        ]}
      >
        remaining
      </Text>

      {/* Pace guidance */}
      <Text
        style={[styles.guidance, { fontSize: guidanceSize }]}
        numberOfLines={2}
      >
        "{segment.label}"
      </Text>
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
    marginBottom: 4,
    textAlign: 'center',
  },
  remainingTime: {
    fontFamily: fonts.bold,
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
    letterSpacing: 0.3,
  },
  guidance: {
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
