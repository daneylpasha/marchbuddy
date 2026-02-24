import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, fonts } from '../../theme';

interface ChipSelectorProps {
  options: string[];
  onSelect: (option: string) => void;
  disabled?: boolean;
}

export default function ChipSelector({ options, onSelect, disabled }: ChipSelectorProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      {options.map((option) => (
        <Pressable
          key={option}
          style={({ pressed }) => [styles.chip, pressed && !disabled && styles.chipPressed]}
          onPress={() => !disabled && onSelect(option)}
          disabled={disabled}
        >
          <Text style={styles.chipText}>{option}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  chip: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.dotInactive,
    borderWidth: 1,
    borderColor: colors.textMuted,
    minHeight: 48,
    justifyContent: 'center',
  },
  chipPressed: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
    fontFamily: fonts.medium,
    letterSpacing: 0.3,
  },
});
