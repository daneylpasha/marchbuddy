import React from 'react';
import { View, Text, Pressable, StyleSheet, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../../theme';

interface SettingsRowProps {
  label: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  rightElement?: React.ReactNode;
  labelStyle?: TextStyle;
}

export const SettingsRow: React.FC<SettingsRowProps> = ({
  label,
  value,
  onPress,
  showChevron,
  rightElement,
  labelStyle,
}) => {
  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [styles.container, pressed && styles.pressed]}
        onPress={onPress}
      >
        <Text style={[styles.label, labelStyle]}>{label}</Text>
        <View style={styles.right}>
          {value ? <Text style={styles.value}>{value}</Text> : null}
          {rightElement}
          {showChevron ? (
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} style={styles.chevron} />
          ) : null}
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.label, labelStyle]}>{label}</Text>
      <View style={styles.right}>
        {value ? <Text style={styles.value}>{value}</Text> : null}
        {rightElement}
        {showChevron ? (
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} style={styles.chevron} />
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  pressed: {
    opacity: 0.6,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.textPrimary,
    flex: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  value: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.textSecondary,
  },
  chevron: {
    marginLeft: 6,
  },
});
