import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { calculatePace, formatPace } from '../../../utils/sessionUtils';
import { colors, fonts } from '../../../theme';

interface SessionStatsBarProps {
  distanceKm: number;
  totalElapsedSeconds: number;
  currentSegmentIndex: number;
  totalSegments: number;
  locationPermissionDenied: boolean;
}

export const SessionStatsBar: React.FC<SessionStatsBarProps> = ({
  distanceKm,
  totalElapsedSeconds,
  currentSegmentIndex,
  totalSegments,
  locationPermissionDenied,
}) => {
  const pace = calculatePace(distanceKm, totalElapsedSeconds / 60);

  return (
    <View style={styles.container}>
      <View style={styles.stat}>
        <Text style={styles.value}>
          {locationPermissionDenied ? '--' : distanceKm.toFixed(2)}
        </Text>
        <Text style={styles.unit}>km</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.stat}>
        <Text style={styles.value}>
          {locationPermissionDenied ? '--:--' : formatPace(pace)}
        </Text>
        <Text style={styles.unit}>/km</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.stat}>
        <Text style={styles.value}>
          {currentSegmentIndex + 1}/{totalSegments}
        </Text>
        <Text style={styles.unit}>segments</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  value: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: '#fff',
  },
  unit: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
    letterSpacing: 0.3,
  },
});
