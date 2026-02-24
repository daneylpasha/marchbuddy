import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ProgressBar from '../common/ProgressBar';
import { colors, fonts } from '../../theme';

interface MacroBarProps {
  label: string;
  current: number;
  total: number;
  color: string;
}

export default function MacroBar({ label, current, total, color }: MacroBarProps) {
  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.values}>
          <Text style={{ color }}>{Math.round(current)}g</Text>
          <Text style={styles.separator}> / </Text>
          {total}g
        </Text>
      </View>
      <ProgressBar current={current} total={total} color={color} height={8} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
    fontFamily: fonts.medium,
    letterSpacing: 0.3,
  },
  values: {
    color: colors.textTertiary,
    fontSize: 13,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
  },
  separator: {
    color: '#444',
  },
});
