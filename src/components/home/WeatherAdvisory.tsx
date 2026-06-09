import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WeatherSnapshot } from '../../services/weatherService';
import { colors, fonts } from '../../theme';

interface Props {
  weather: WeatherSnapshot;
}

const SEVERITY_COLORS = {
  info: { tint: colors.primary, bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.30)' },
  warning: { tint: '#F5B82E', bg: 'rgba(245,184,46,0.10)', border: 'rgba(245,184,46,0.30)' },
  danger: { tint: '#EF4444', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.30)' },
};

function iconFor(severity: NonNullable<WeatherSnapshot['advisory']>['severity']): keyof typeof Ionicons.glyphMap {
  if (severity === 'danger') return 'warning';
  if (severity === 'warning') return 'alert-circle';
  return 'information-circle';
}

export function WeatherAdvisory({ weather }: Props) {
  const advisory = weather.advisory;
  if (!advisory) return null;
  const palette = SEVERITY_COLORS[advisory.severity];

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: palette.bg, borderColor: palette.border },
      ]}
    >
      <Ionicons name={iconFor(advisory.severity)} size={18} color={palette.tint} />
      <View style={styles.body}>
        <Text style={[styles.title, { color: palette.tint }]}>{advisory.title}</Text>
        <Text style={styles.message}>{advisory.body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  body: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 13,
    letterSpacing: 0.3,
  },
  message: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
