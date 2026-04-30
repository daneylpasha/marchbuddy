import React, { useRef } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { calculatePace, formatPace } from '../../../utils/sessionUtils';
import { colors, fonts } from '../../../theme';
import PaceInfoSheet, { type PaceInfoSheetRef } from './PaceInfoSheet';

interface SessionStatsBarProps {
  distanceKm: number;
  totalElapsedSeconds: number;
  currentSegmentIndex: number;
  totalSegments: number;
  locationPermissionDenied: boolean;
  stepCount: number;
  pedometerAvailable: boolean;
}

const formatSteps = (steps: number): string => {
  if (steps >= 10000) return `${(steps / 1000).toFixed(1)}k`;
  return steps.toString();
};

export const SessionStatsBar: React.FC<SessionStatsBarProps> = ({
  distanceKm,
  totalElapsedSeconds,
  currentSegmentIndex,
  totalSegments,
  locationPermissionDenied,
  stepCount,
  pedometerAvailable,
}) => {
  // Suppress pace until enough distance is covered — at sub-100m the
  // formula (time/distance) swings wildly with normal GPS jitter.
  const pace = distanceKm < 0.1 ? null : calculatePace(distanceKm, totalElapsedSeconds / 60);

  const paceSheetRef = useRef<PaceInfoSheetRef>(null);

  return (
    <>
      <View style={styles.container}>
        <View style={styles.stat}>
          <Text style={styles.value} numberOfLines={1}>
            {locationPermissionDenied ? '--' : distanceKm.toFixed(2)}
          </Text>
          <Text style={styles.unit}>km</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.stat}>
          <Text style={styles.value} numberOfLines={1}>
            {locationPermissionDenied ? '--:--' : formatPace(pace)}
          </Text>
          <Pressable
            onPress={() => paceSheetRef.current?.present()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.unitRow}
          >
            <Text style={styles.unit}>/km</Text>
            <Ionicons
              name="information-circle-outline"
              size={12}
              color={colors.textTertiary}
              style={styles.unitInfoIcon}
            />
          </Pressable>
        </View>

        <View style={styles.divider} />

        <View style={styles.stat}>
          <Text style={styles.value} numberOfLines={1}>
            {pedometerAvailable ? formatSteps(stepCount) : '--'}
          </Text>
          <Text style={styles.unit}>steps</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.stat}>
          <Text style={styles.value} numberOfLines={1}>
            {currentSegmentIndex + 1}/{totalSegments}
          </Text>
          <Text style={styles.unit}>segs</Text>
        </View>
      </View>

      <PaceInfoSheet ref={paceSheetRef} />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  divider: {
    width: 1,
    height: 26,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  value: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: '#fff',
  },
  unit: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  unitInfoIcon: {
    marginTop: 2,
  },
});
