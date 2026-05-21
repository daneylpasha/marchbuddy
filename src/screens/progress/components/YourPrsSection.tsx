// ============================================================================
// YourPrsSection — Progress tab section listing the user's personal records.
//
// Layout: list of cards, newest first. Each card shows pr_type, value,
// achieved date, and the session it was set in. Tap → past session detail.
//
// V2 scope: flat list. V2.1 will add per-type mini-chart showing how each
// PR was beaten over time (data is already in `personal_records.value`).
// ============================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing } from '../../../theme';
import { useAuthStore } from '../../../store/authStore';
import { useRunProgressStore } from '../../../store/runProgressStore';
import { fetchUserPrs } from '../../../services/prApi';
import {
  formatPrValue,
  prTypeLabel,
  previousValueLabel,
  type PersonalRecord,
} from '../../../types/personalRecord';
import { analytics, EVENTS } from '../../../services/analytics';
import type { ProgressStackParamList } from '../../../navigation/ProgressNavigator';

type Nav = NativeStackNavigationProp<ProgressStackParamList>;

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const diffMs = today.getTime() - date.getTime();
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function iconForPrType(type: PersonalRecord['pr_type']): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'first_milestone':
      return 'flag';
    case 'fastest_pace':
    case 'fastest_1k_split':
      return 'flash';
    case 'longest_distance':
      return 'map';
    case 'longest_duration':
      return 'time';
    case 'highest_cadence':
      return 'pulse';
  }
}

export const YourPrsSection: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const userId = useAuthStore((s) => s.session?.user?.id);
  const sessionHistory = useRunProgressStore((s) => s.sessionHistory);
  const [prs, setPrs] = useState<PersonalRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [viewedSent, setViewedSent] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    const data = await fetchUserPrs(userId);
    setPrs(data);
    setIsLoading(false);
  }, [userId]);

  // Refresh on tab focus so a freshly-detected PR shows up without a manual
  // pull. Cheap: indexed query with LIMIT-less but small per-user row count.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Fire `pr_viewed` once per Progress tab visit IF any PRs are rendered.
  // Spec defines surface='progress_tab' for this event.
  useEffect(() => {
    if (viewedSent || prs.length === 0) return;
    analytics.track(EVENTS.pr_viewed, {
      surface: 'progress_tab',
      pr_count: prs.length,
    });
    setViewedSent(true);
  }, [prs, viewedSent]);

  // Build a map of session_id → CompletedSession so we can navigate to past
  // detail. sessionHistory is local-only; if the PR's session_id isn't in
  // it (e.g. backfilled rows from server-only history), we fall back to a
  // no-op tap with a subtle visual.
  const sessionsById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof Object.assign>>();
    for (const s of sessionHistory ?? []) {
      if (s.id) map.set(s.id, s);
    }
    return map;
  }, [sessionHistory]);

  if (!userId) return null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>YOUR PRs</Text>
        {prs.length > 0 ? (
          <Text style={styles.count}>{prs.length}</Text>
        ) : null}
      </View>

      {isLoading && prs.length === 0 ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.textMuted} />
        </View>
      ) : prs.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="trophy-outline" size={28} color={colors.textMuted} />
          <Text style={styles.emptyText}>
            Personal records will appear here as you complete more sessions.
          </Text>
          <Text style={styles.emptySubtext}>
            Tracking 5 record types automatically — fastest pace, fastest 1K, longest distance,
            longest session, and milestones.
          </Text>
        </View>
      ) : (
        prs.map((pr) => {
          const matchingSession = sessionsById.get(pr.session_id);
          const onPress = matchingSession
            ? () => navigation.navigate('PastSessionDetail', { session: matchingSession })
            : undefined;
          const subtitle = previousValueLabel(pr);
          const valueStr = formatPrValue(pr);
          const labelStr = prTypeLabel(pr.pr_type, pr.pr_subtype);
          return (
            <TouchableOpacity
              key={pr.id}
              activeOpacity={onPress ? 0.7 : 1}
              onPress={onPress}
              style={[
                styles.prCard,
                pr.confidence === 'low' && styles.prCardLow,
                !onPress && styles.prCardDisabled,
              ]}
            >
              <View style={styles.iconWrap}>
                <Ionicons name={iconForPrType(pr.pr_type)} size={18} color="#FFD466" />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {labelStr}
                  {valueStr ? ` · ${valueStr}` : ''}
                </Text>
                {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
                <Text style={styles.cardDate}>{formatRelativeDate(pr.achieved_at)}</Text>
              </View>
              {pr.confidence === 'low' ? (
                <View style={styles.lowConfidenceBadge}>
                  <Text style={styles.lowConfidenceText}>Low GPS</Text>
                </View>
              ) : onPress ? (
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              ) : null}
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 1.4,
    color: colors.textSecondary,
  },
  count: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: '#FFD466',
  },
  loadingRow: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyCard: {
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  emptyText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  emptySubtext: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 17,
  },
  prCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 212, 102, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 212, 102, 0.15)',
  },
  prCardLow: {
    backgroundColor: 'rgba(255, 212, 102, 0.03)',
    borderColor: 'rgba(255, 212, 102, 0.08)',
  },
  prCardDisabled: {
    opacity: 0.85,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,212,102,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  cardSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cardDate: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  lowConfidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  lowConfidenceText: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.textSecondary,
  },
});
