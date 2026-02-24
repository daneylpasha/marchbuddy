import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../theme';

interface Props {
  label: string;
  value: string;
  trend?: 'up' | 'down' | 'flat';
  trendLabel?: string;
  color?: string;
  onPress?: () => void;
}

export default function StatCard({ label, value, trend, trendLabel, color = colors.primary, onPress }: Props) {
  const trendIcon = trend === 'up' ? 'arrow-up' : trend === 'down' ? 'arrow-down' : 'remove';
  const trendColor = trend === 'up' ? colors.success : trend === 'down' ? colors.danger : colors.textSecondary;

  const content = (
    <>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color }]}>{value}</Text>
      {trend && (
        <View style={styles.trendRow}>
          <Ionicons name={trendIcon} size={13} color={trendColor} />
          {trendLabel ? <Text style={[styles.trendLabel, { color: trendColor }]}>{trendLabel}</Text> : null}
        </View>
      )}
    </>
  );

  if (onPress) {
    return (
      <Pressable style={({ pressed }) => [styles.container, pressed && styles.pressed]} onPress={onPress}>
        {content}
      </Pressable>
    );
  }

  return <View style={styles.container}>{content}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  pressed: { opacity: 0.7 },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: '500', fontFamily: fonts.medium, letterSpacing: 0.3 },
  value: { fontSize: 28, fontWeight: '700', fontFamily: fonts.bold, letterSpacing: 0.3, fontVariant: ['tabular-nums'] },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  trendLabel: { fontSize: 12, fontWeight: '500', fontFamily: fonts.medium, letterSpacing: 0.3 },
});
