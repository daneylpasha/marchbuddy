// ============================================================================
// ComparisonCard — "Progress check" card shown when there's a meaningful
// Before/After comparison but NO PR was set. Smaller treatment than the
// PrBanner — meant to whisper progress, not shout it.
//
// Spec rule: only render if a comparison was returned. The Edge Function
// already filtered out regressions and <5% improvements; this component
// trusts whatever it's handed.
// ============================================================================

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../../../theme';
import type { Comparison } from '../../../types/personalRecord';

interface Props {
  comparison: Comparison;
}

function eyebrowFor(window: Comparison['window']): string {
  switch (window) {
    case 'vs_4_weeks_ago_same_distance':
      return 'Progress check · 4 weeks';
    case 'vs_first_at_level':
      return 'Progress check · this level';
    case 'vs_last_week_same_type':
      return 'Progress check · same session';
    case 'vs_prior_30_day_avg':
      return 'Progress check · this month';
  }
}

export const ComparisonCard: React.FC<Props> = ({ comparison }) => {
  const eyebrow = eyebrowFor(comparison.window);
  const pctStr = `${comparison.improvement_pct.toFixed(0)}% faster`;
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Ionicons name="trending-up" size={16} color={colors.primary} />
        <Text style={styles.eyebrow}>{eyebrow}</Text>
      </View>
      <Text style={styles.label}>{comparison.label}</Text>
      <Text style={styles.delta}>{pctStr}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eyebrow: {
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.primary,
    textTransform: 'uppercase',
    marginLeft: 6,
  },
  label: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textPrimary,
    marginTop: 6,
  },
  delta: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.primary,
    marginTop: 4,
  },
});
