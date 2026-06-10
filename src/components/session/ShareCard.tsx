import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteMap } from './RouteMap';
import {
  convertPace,
  formatDistance,
  getDistanceLabel,
  getPaceLabel,
  useDistanceUnit,
} from '../../utils/distanceUtils';
import { estimateSessionCalories, formatDuration } from '../../utils/sessionUtils';
import { colors, fonts } from '../../theme';
import { prTypeLabel, type PersonalRecord } from '../../types/personalRecord';
import type { CompletedSession } from '../../types/session';

const BRAND_LOGO = require('../../../assets/splash-logo-transparent.png');

export const CARD_WIDTH = 360;
export const CARD_HEIGHT = 560;
const MAP_HEIGHT = 230;

function formatPace(minutesPerKm: number | null): string {
  if (minutesPerKm == null || !isFinite(minutesPerKm) || minutesPerKm <= 0) return '—';
  const m = Math.floor(minutesPerKm);
  const s = Math.round((minutesPerKm - m) * 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function pickFeaturedPr(prs: PersonalRecord[]): PersonalRecord {
  const order: PersonalRecord['pr_type'][] = [
    'first_milestone',
    'longest_distance',
    'longest_duration',
    'fastest_pace',
    'fastest_1k_split',
    'highest_cadence',
  ];
  return [...prs].sort((a, b) => order.indexOf(a.pr_type) - order.indexOf(b.pr_type))[0];
}

interface Props {
  session: CompletedSession;
  prs?: PersonalRecord[];
}

const ShareCard = React.forwardRef<View, Props>(({ session, prs = [] }, ref) => {
  const unit = useDistanceUnit();
  const distanceLabel = getDistanceLabel(unit);
  const paceLabel = getPaceLabel(unit);
  const paceStr = formatPace(convertPace(session.pacePerKm, unit));
  const durationSeconds = session.actualDurationMinutes * 60;
  const isOutdoor = session.environment !== 'indoor';
  const hasRoute = isOutdoor && session.route && session.route.length >= 2;

  const featuredPr: PersonalRecord | null = prs.length > 0 ? pickFeaturedPr(prs) : null;
  const badgeLabel = featuredPr ? prTypeLabel(featuredPr.pr_type, featuredPr.pr_subtype) : null;
  const isMilestone = featuredPr?.pr_type === 'first_milestone';

  const distanceStr =
    session.actualDistanceKm > 0 ? formatDistance(session.actualDistanceKm, unit) : '—';
  const calories = estimateSessionCalories(session);
  const stepsStr = session.actualSteps > 0 ? session.actualSteps.toLocaleString() : null;

  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      {/* Brand header — large logo, no wordmark */}
      <View style={styles.cardHeader}>
        <Image source={BRAND_LOGO} style={styles.brandLogo} resizeMode="contain" />
        <Text style={styles.cardDate}>{formatDate(session.completedAt)}</Text>
      </View>

      {/* PR / milestone badge */}
      {featuredPr ? (
        <View style={styles.prBadge}>
          <Ionicons name={isMilestone ? 'flag' : 'trophy'} size={12} color="#0A0A0A" />
          <Text style={styles.prBadgeText} numberOfLines={1}>
            {isMilestone ? 'NEW MILESTONE' : 'NEW PR'}
            {' · '}
            {badgeLabel}
          </Text>
        </View>
      ) : null}

      {/* Map / fallback */}
      <View style={styles.mapBlock}>
        {hasRoute ? (
          <RouteMap route={session.route!} height={MAP_HEIGHT} style={styles.mapStyleOverride} />
        ) : (
          <View style={[styles.mapFallback, { height: MAP_HEIGHT }]}>
            <Ionicons
              name={isOutdoor ? 'navigate-outline' : 'home-outline'}
              size={48}
              color={colors.primary}
            />
            <Text style={styles.mapFallbackText}>
              {isOutdoor ? 'Route not recorded' : 'Indoor session'}
            </Text>
          </View>
        )}
      </View>

      {/* Stats grid — 4 stats so the full picture of the session is visible */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{distanceStr}</Text>
          <Text style={styles.statLabel} numberOfLines={1}>
            {distanceLabel.toUpperCase()}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatDuration(durationSeconds)}</Text>
          <Text style={styles.statLabel}>TIME</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{paceStr}</Text>
          <Text style={styles.statLabel} numberOfLines={1}>
            {paceLabel.toUpperCase()}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{calories != null ? calories.toString() : '—'}</Text>
          <Text style={styles.statLabel}>KCAL</Text>
        </View>
      </View>

      {/* Steps row — fills out "all progress" without cluttering the main grid */}
      {stepsStr ? (
        <View style={styles.metaRow}>
          <Ionicons name="footsteps-outline" size={13} color={colors.primary} />
          <Text style={styles.metaText}>{stepsStr} steps</Text>
        </View>
      ) : null}

      {/* Footer */}
      <View style={styles.cardFooter}>
        <View style={styles.cardFooterLeft}>
          <Text style={styles.cardPlan} numberOfLines={1}>
            {session.planTitle}
          </Text>
          <Text style={styles.cardLevel}>Level {session.planLevel}</Text>
        </View>
        <View style={styles.completedBadge}>
          <Ionicons name="checkmark" size={14} color="#fff" />
          <Text style={styles.completedBadgeText}>Completed</Text>
        </View>
      </View>

      {/* Watermark — logo only (no text), bottom-right, stays visible after
          Instagram / WhatsApp story crops. */}
      <View style={styles.watermark}>
        <Image source={BRAND_LOGO} style={styles.watermarkLogo} resizeMode="contain" />
      </View>
    </View>
  );
});

ShareCard.displayName = 'ShareCard';
export default ShareCard;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: '#0E1410',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(6,138,21,0.35)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
  },
  brandLogo: {
    width: 56,
    height: 56,
  },
  cardDate: {
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 0.4,
    color: 'rgba(255,255,255,0.6)',
  },
  prBadge: {
    position: 'absolute',
    top: 76,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#FFD466',
    gap: 4,
    maxWidth: CARD_WIDTH - 28,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    zIndex: 10,
  },
  prBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1,
    color: '#0A0A0A',
  },
  mapBlock: {
    paddingHorizontal: 14,
  },
  mapStyleOverride: {
    borderRadius: 14,
  },
  mapFallback: {
    borderRadius: 14,
    backgroundColor: 'rgba(6,138,21,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(6,138,21,0.2)',
  },
  mapFallbackText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  statsRow: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: '#fff',
    letterSpacing: 0.3,
  },
  statLabel: {
    fontFamily: fonts.regular,
    fontSize: 9,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.6,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: 8,
  },
  metaText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 0.3,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 14,
    marginTop: 'auto',
  },
  cardFooterLeft: { flex: 1, gap: 2 },
  cardPlan: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: '#fff',
    letterSpacing: 0.3,
  },
  cardLevel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.4,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  completedBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: '#fff',
    letterSpacing: 0.6,
  },
  watermark: {
    position: 'absolute',
    bottom: 8,
    right: 12,
    opacity: 0.55,
  },
  watermarkLogo: {
    width: 24,
    height: 24,
  },
});
