// ============================================================================
// PrBanner — slide-down banner shown at the top of the post-session summary
// when one or more PRs were detected. Triggers haptic on reveal (per spec).
//
// Animation: starts off-screen above, slides down + fades in over ~450ms.
// Confetti firing is the parent's responsibility (we don't double-fire it
// here; the screen already has Celebration confetti coverage).
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../../../theme';
import type { PersonalRecord } from '../../../types/personalRecord';
import { formatPrValue, prTypeLabel, previousValueLabel } from '../../../types/personalRecord';

interface Props {
  prs: PersonalRecord[];
  onSharePress?: () => Promise<void>;
}

/**
 * Pick the single most "impressive" PR to feature in the banner if there
 * are multiple. Ranking is intentionally simple:
 *   first_milestone > longest_distance > longest_duration > fastest_pace > 1k_split
 * — first-time milestones are the most emotional moment, so they win.
 */
function pickFeaturedPr(prs: PersonalRecord[]): PersonalRecord {
  const order: PersonalRecord['pr_type'][] = [
    'first_milestone',
    'longest_distance',
    'longest_duration',
    'fastest_pace',
    'fastest_1k_split',
    'highest_cadence',
  ];
  return [...prs].sort(
    (a, b) => order.indexOf(a.pr_type) - order.indexOf(b.pr_type),
  )[0];
}

export const PrBanner: React.FC<Props> = ({ prs, onSharePress }) => {
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    // Slide-down + fade-in + subtle haptic on appearance.
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateY, opacity]);

  if (prs.length === 0) return null;

  const featured = pickFeaturedPr(prs);
  const label = prTypeLabel(featured.pr_type, featured.pr_subtype);
  const valueStr = formatPrValue(featured);
  const subtitle = previousValueLabel(featured);
  const isMilestone = featured.pr_type === 'first_milestone';
  const additionalCount = prs.length - 1;

  return (
    <Animated.View
      style={[
        styles.container,
        featured.confidence === 'low' && styles.containerLowConfidence,
        { transform: [{ translateY }], opacity },
      ]}
    >
      <View style={styles.iconWrap}>
        <Ionicons
          name={isMilestone ? 'flag' : 'trophy'}
          size={22}
          color="#FFD466"
        />
      </View>
      <View style={styles.textBlock}>
        <Text style={styles.eyebrow}>
          {isMilestone ? 'New milestone' : 'New PR'}
        </Text>
        <Text style={styles.headline} numberOfLines={1}>
          {label}
          {valueStr ? ` · ${valueStr}` : ''}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {additionalCount > 0 ? (
          <Text style={styles.additional}>
            +{additionalCount} more record{additionalCount === 1 ? '' : 's'} set today
          </Text>
        ) : null}
        {featured.confidence === 'low' ? (
          <Text style={styles.lowConfidence}>
            Recorded with lower GPS / manual data — view in Progress
          </Text>
        ) : null}
      </View>

      {onSharePress ? (
        <TouchableOpacity
          style={[styles.shareBtn, isSharing && styles.shareBtnDisabled]}
          onPress={async () => {
            if (isSharing) return;
            setIsSharing(true);
            try {
              await onSharePress();
            } finally {
              setIsSharing(false);
            }
          }}
          activeOpacity={0.7}
          hitSlop={8}
        >
          <Ionicons
            name={isSharing ? 'hourglass-outline' : 'share-social-outline'}
            size={18}
            color="#FFD466"
          />
        </TouchableOpacity>
      ) : null}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 212, 102, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 212, 102, 0.35)',
  },
  containerLowConfidence: {
    backgroundColor: 'rgba(255, 212, 102, 0.06)',
    borderColor: 'rgba(255, 212, 102, 0.18)',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 212, 102, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  textBlock: {
    flex: 1,
  },
  eyebrow: {
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 1.2,
    color: '#FFD466',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  headline: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  additional: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
  },
  lowConfidence: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  shareBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
    backgroundColor: 'rgba(255, 212, 102, 0.1)',
  },
  shareBtnDisabled: {
    opacity: 0.5,
  },
});
