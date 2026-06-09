import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WeatherSnapshot } from '../../services/weatherService';
import { colors, fonts } from '../../theme';

interface Props {
  weather: WeatherSnapshot;
}

function iconFor(condition: WeatherSnapshot['condition']): keyof typeof Ionicons.glyphMap {
  switch (condition) {
    case 'very_hot':
    case 'hot':
      return 'sunny';
    case 'pleasant':
      return 'partly-sunny';
    case 'cool':
      return 'cloud-outline';
    case 'cold':
      return 'thermometer';
    case 'rain':
      return 'rainy';
    case 'storm':
      return 'thunderstorm';
    case 'snow':
      return 'snow';
    case 'fog':
      return 'cloudy';
    default:
      return 'partly-sunny';
  }
}

export function WeatherChip({ weather }: Props) {
  return (
    <View style={styles.chip}>
      <Ionicons name={iconFor(weather.condition)} size={13} color={colors.textSecondary} />
      <Text style={styles.text} numberOfLines={1}>
        {weather.shortLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 4,
  },
  text: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },
});
