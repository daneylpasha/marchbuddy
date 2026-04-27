import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { formatDuration } from '../../../utils/sessionUtils';
import { colors, fonts } from '../../../theme';

interface SessionTimerProps {
  totalElapsedSeconds: number;
  isPaused: boolean;
}

export const SessionTimer: React.FC<SessionTimerProps> = ({
  totalElapsedSeconds,
  isPaused,
}) => {
  const { height } = useWindowDimensions();
  const timeSize = height < 700 ? 46 : height < 800 ? 54 : 64;

  return (
    <View style={styles.container}>
      <Text
        style={[styles.time, { fontSize: timeSize }, isPaused && styles.timePaused]}
        numberOfLines={1}
      >
        {formatDuration(totalElapsedSeconds)}
      </Text>
      <Text style={styles.label}>ELAPSED TIME</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  time: {
    fontFamily: fonts.bold,
    color: '#fff',
    letterSpacing: 2,
  },
  timePaused: {
    opacity: 0.45,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.textTertiary,
    marginTop: 6,
  },
});
