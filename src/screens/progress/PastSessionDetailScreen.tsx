import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RouteMap } from '../../components/session/RouteMap';
import ShareCard from '../../components/session/ShareCard';
import { shareCelebrationCard } from '../../utils/shareCelebrationCard';
import {
  formatDistance,
  getDistanceLabel,
  useDistanceUnit,
} from '../../utils/distanceUtils';
import { colors, fonts, spacing } from '../../theme';
import type { ProgressStackParamList } from '../../navigation/ProgressNavigator';
import type { CompletedSession, SessionRecord, SessionSegment } from '../../types/session';

type Props = NativeStackScreenProps<ProgressStackParamList, 'PastSessionDetail'>;

function formatDuration(minutes: number): string {
  const m = Math.floor(minutes);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function feedbackLabel(rating: string | null): string | null {
  if (!rating) return null;
  switch (rating) {
    case 'too_easy':
      return 'Too easy';
    case 'just_right':
      return 'Just right';
    case 'challenging':
      return 'Challenging';
    case 'too_hard':
      return 'Too hard';
    default:
      return rating;
  }
}

// ShareCard was designed against CompletedSession, which carries a few fields
// past SessionRecord drops (planVariant, pace, full segment objects…). Re-share
// from history is purely visual: ShareCard only reads plannedSegments.length,
// so we rebuild an array of the right size from the stored count without
// fabricating segment payloads. Steps and segment counts now flow through
// SessionRecord — legacy rows (and server-pulled history) lack them and fall
// back to 0, which ShareCard renders as "row hidden" or "0 / X".
function recordToShareSession(record: SessionRecord): CompletedSession {
  const completedAtIso = `${record.date}T12:00:00.000Z`;
  const segmentCount = record.plannedSegmentsCount ?? 0;
  const plannedSegments = Array.from(
    { length: segmentCount },
    () => ({}) as SessionSegment,
  );
  return {
    id: record.id,
    orderId: record.id,
    planId: record.id,
    planLevel: record.planLevel,
    planVariant: 'recommended',
    planTitle: record.planTitle,
    plannedDurationMinutes: record.durationMinutes,
    plannedSegments,
    actualDurationMinutes: record.durationMinutes,
    actualDistanceKm: record.distanceKm,
    actualSteps: record.actualSteps ?? 0,
    completedSegments: record.completedSegments ?? 0,
    endedEarly: record.endedEarly,
    // Pace = minutes/km. Derive only when we have a real distance.
    pacePerKm:
      record.distanceKm > 0 ? record.durationMinutes / record.distanceKm : null,
    route: record.route ?? [],
    environment: record.environment ?? 'outdoor',
    treadmillStats: null,
    feedbackRating: (record.feedbackRating as CompletedSession['feedbackRating']) ?? null,
    feedbackNotes: null,
    startedAt: completedAtIso,
    completedAt: completedAtIso,
  };
}

export default function PastSessionDetailScreen({ navigation, route }: Props) {
  const { session } = route.params;
  const isOutdoor = session.environment !== 'indoor';
  const hasRoute = isOutdoor && session.route && session.route.length >= 2;
  const feedback = feedbackLabel(session.feedbackRating);
  const unit = useDistanceUnit();

  const shareCardRef = useRef<View>(null);
  const [isSharing, setIsSharing] = useState(false);
  const shareSession = React.useMemo(() => recordToShareSession(session), [session]);

  const handleShare = async () => {
    if (isSharing) return;
    setIsSharing(true);
    try {
      await shareCelebrationCard(shareCardRef, 'Share your MarchBuddy session', 'session');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerLabel}>SESSION</Text>
          <Text style={styles.headerTitle}>{formatDate(session.date)}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Map (outdoor only) */}
        {hasRoute ? (
          <RouteMap route={session.route!} height={260} style={styles.mapShadow} />
        ) : (
          <View style={styles.noMapCard}>
            <Ionicons
              name={isOutdoor ? 'navigate-outline' : 'home-outline'}
              size={28}
              color={colors.textMuted}
            />
            <Text style={styles.noMapText}>
              {isOutdoor
                ? 'No route recorded for this session'
                : 'Indoor session — no route recorded'}
            </Text>
          </View>
        )}

        {/* Plan title + level */}
        <View style={styles.planHeader}>
          <Text style={styles.planTitle} numberOfLines={2}>
            {session.planTitle}
          </Text>
          <View style={styles.planMetaRow}>
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>LEVEL {session.planLevel}</Text>
            </View>
            {session.endedEarly && (
              <View style={styles.endedEarlyBadge}>
                <Ionicons name="time-outline" size={11} color={colors.warning} />
                <Text style={styles.endedEarlyText}>Ended early</Text>
              </View>
            )}
          </View>
        </View>

        {/* Stats grid */}
        <View style={styles.statsCard}>
          <View style={styles.statBlock}>
            <Ionicons name="time-outline" size={20} color={colors.primary} />
            <Text style={styles.statValue}>{formatDuration(session.durationMinutes)}</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}>
            <Ionicons name="navigate-outline" size={20} color={colors.primary} />
            <Text style={styles.statValue}>
              {session.distanceKm > 0 ? formatDistance(session.distanceKm, unit) : '—'}
            </Text>
            <Text style={styles.statLabel}>
              {session.distanceKm > 0 ? getDistanceLabel(unit) : 'Distance'}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}>
            <Ionicons
              name={isOutdoor ? 'leaf-outline' : 'home-outline'}
              size={20}
              color={colors.primary}
            />
            <Text style={styles.statValue}>{isOutdoor ? 'Outdoor' : 'Indoor'}</Text>
            <Text style={styles.statLabel}>Location</Text>
          </View>
        </View>

        {/* Feedback */}
        {feedback && (
          <View style={styles.feedbackCard}>
            <Text style={styles.cardLabel}>HOW IT FELT</Text>
            <Text style={styles.feedbackText}>{feedback}</Text>
          </View>
        )}

        {/* Share later — lets users post a past session whenever they want
            (e.g., they skipped sharing right after the run). */}
        <Pressable
          style={({ pressed }) => [
            styles.shareButton,
            isSharing && styles.shareButtonDisabled,
            pressed && !isSharing && styles.shareButtonPressed,
          ]}
          onPress={handleShare}
          disabled={isSharing}
        >
          {isSharing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="share-social-outline" size={18} color="#fff" />
              <Text style={styles.shareButtonText}>Share this session</Text>
            </>
          )}
        </Pressable>
      </ScrollView>

      {/* Off-screen ShareCard — captured by react-native-view-shot when the
          user taps Share. Positioned absolutely off the visible area instead
          of using `display: none` so layout still computes. */}
      <View style={styles.captureHost} pointerEvents="none">
        <ShareCard ref={shareCardRef} session={shareSession} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  backButton: { padding: 4 },
  headerCenter: { alignItems: 'center', gap: 2 },
  headerLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  headerSpacer: { width: 36 },

  scrollContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 18,
    paddingBottom: 40,
    gap: 16,
  },

  mapShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  noMapCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 18,
    paddingVertical: 36,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  noMapText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
    letterSpacing: 0.2,
  },

  planHeader: { gap: 10, paddingTop: 4 },
  planTitle: {
    fontFamily: fonts.titleRegular,
    fontSize: 28,
    color: colors.textPrimary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  planMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  levelBadge: {
    backgroundColor: colors.primaryDim,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  levelBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.primary,
    letterSpacing: 1,
  },
  endedEarlyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.warning + '22',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  endedEarlyText: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
    color: colors.warning,
    letterSpacing: 0.3,
  },

  statsCard: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: spacing.cardRadius,
    paddingVertical: 18,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  statBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  statLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textTertiary,
    letterSpacing: 0.3,
  },
  statDivider: {
    width: 1,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },

  feedbackCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: spacing.cardRadius,
    padding: spacing.cardPadding,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    gap: 8,
  },
  cardLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  feedbackText: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 6,
  },
  shareButtonDisabled: { opacity: 0.55 },
  shareButtonPressed: { opacity: 0.85 },
  shareButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: '#fff',
    letterSpacing: 0.3,
  },
  // Off-screen mount for the capture target. Far enough off the viewport
  // that it never paints on top of the real UI.
  captureHost: {
    position: 'absolute',
    left: -10000,
    top: 0,
  },
});
