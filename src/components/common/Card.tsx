import React from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { colors, spacing, fonts } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}

export default function Card({ children, onPress, style }: CardProps) {
  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
        onPress={onPress}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <Pressable style={[styles.card, style]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: spacing.cardRadius,
    paddingVertical: spacing.cardPadding,
    paddingHorizontal: spacing.cardPadding + 4,
    marginBottom: spacing.cardMarginBottom,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
