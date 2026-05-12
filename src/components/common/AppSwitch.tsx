// AppSwitch — a centralized wrapper around React Native's <Switch> with
// the styling MarchBuddy uses everywhere. Importantly:
//
//   • White thumb on green track when ON — proper contrast (the previous
//     pattern of green-thumb-on-green-track was almost invisible).
//   • Subtle dark track when OFF — matches the surfaceElevated palette
//     instead of using a generic gray.
//   • Slight downscale on Android — the platform default is visually
//     chunkier than iOS; 0.9× brings it in line.
//
// Use this anywhere a toggle is needed. Don't reach for <Switch> directly
// from a screen — that's how the old inconsistent styling crept in.

import React from 'react';
import { Switch, Platform, StyleSheet } from 'react-native';
import { colors } from '../../theme';

interface Props {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}

export const AppSwitch: React.FC<Props> = ({
  value,
  onValueChange,
  disabled,
  accessibilityLabel,
}) => {
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      // Track: brand green when ON, dark elevated surface when OFF
      trackColor={{
        false: colors.surfaceElevated,
        true: colors.primary,
      }}
      // Thumb: always white on iOS for the native feel; on Android we
      // still want white-on-green for ON, but Android's OFF state needs
      // a more visible thumb so it doesn't disappear into the dark track.
      thumbColor={Platform.OS === 'ios' ? '#FFFFFF' : value ? '#FFFFFF' : '#9CA3AF'}
      // iOS-only — track color when OFF. Mirrors trackColor.false so the
      // off-state track stays consistent through the swipe gesture.
      ios_backgroundColor={colors.surfaceElevated}
      style={styles.switch}
    />
  );
};

const styles = StyleSheet.create({
  switch: {
    // Slightly smaller on Android — Material switches are visually larger
    // than iOS by default. Scale gets them aligned with the rest of the UI.
    transform: Platform.OS === 'android' ? [{ scaleX: 0.9 }, { scaleY: 0.9 }] : [],
  },
});
