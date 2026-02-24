import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SessionPlan } from '../../../types/session';
import { formatDurationMinutes } from '../../../utils/sessionUtils';
import { colors, fonts } from '../../../theme';

interface AlternativeSessionCardProps {
  plan: SessionPlan;
  onPress: () => void;
}

const VARIANT_INFO: Record<string, { label: string; sublabel: string }> = {
  quick:     { label: 'Quick',     sublabel: 'Lighter' },
  challenge: { label: 'Challenge', sublabel: 'More' },
  push:      { label: 'Push It',   sublabel: 'Extended' },
  recommended: { label: 'Standard', sublabel: '' },
};

export const AlternativeSessionCard: React.FC<AlternativeSessionCardProps> = ({
  plan,
  onPress,
}) => {
  const info = VARIANT_INFO[plan.variant] ?? { label: plan.variant, sublabel: '' };

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.containerPressed]}
      onPress={onPress}
    >
      <Text style={styles.label}>{info.label}</Text>
      <Text style={styles.duration}>{formatDurationMinutes(plan.totalDurationMinutes)}</Text>
      {info.sublabel ? <Text style={styles.sublabel}>{info.sublabel}</Text> : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  containerPressed: { opacity: 0.7 },
  label: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  duration: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.primary,
    marginBottom: 2,
  },
  sublabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textTertiary,
  },
});
