import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../theme';

type DayStatus = 'completed' | 'partial' | 'missed' | 'rest' | 'future';

interface Props {
  /** 7-element array, Mon→Sun */
  days: { label: string; status: DayStatus }[];
}

const STATUS_CONFIG: Record<DayStatus, { bg: string; icon: keyof typeof Ionicons.glyphMap; iconColor: string }> = {
  completed: { bg: colors.successDim, icon: 'checkmark-circle', iconColor: colors.success },
  partial: { bg: colors.warningDim, icon: 'ellipse-outline', iconColor: colors.warning },
  missed: { bg: colors.dangerDim, icon: 'close-circle', iconColor: colors.danger },
  rest: { bg: colors.primaryDim, icon: 'bed-outline', iconColor: colors.primary },
  future: { bg: colors.surfaceElevated, icon: 'ellipse-outline', iconColor: '#444' },
};

export default function ConsistencyGrid({ days }: Props) {
  return (
    <View style={styles.row}>
      {days.map((day, i) => {
        const cfg = STATUS_CONFIG[day.status];
        return (
          <View key={i} style={styles.dayCol}>
            <View style={[styles.circle, { backgroundColor: cfg.bg }]}>
              <Ionicons name={cfg.icon} size={18} color={cfg.iconColor} />
            </View>
            <Text style={styles.label}>{day.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { alignItems: 'center', gap: 4 },
  circle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: { color: colors.textSecondary, fontSize: 10, fontWeight: '500', fontFamily: fonts.medium, letterSpacing: 0.3 },
});
