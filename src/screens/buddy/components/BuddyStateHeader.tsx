import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, fonts, spacing } from '../../../theme';

interface Props {
  myName: string;
  buddyName: string;
  buddyLevel: number;
  /** ISO timestamp — preferably accepted_at, falls back to created_at. */
  pairedSince: string | null;
}

function initial(name: string): string {
  return (name.trim().charAt(0) || '?').toUpperCase();
}

function formatPairedSince(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  const opts: Intl.DateTimeFormatOptions = sameYear
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' };
  return `Buddies since ${date.toLocaleDateString(undefined, opts)}`;
}

export default function BuddyStateHeader({
  myName,
  buddyName,
  buddyLevel,
  pairedSince,
}: Props) {
  const sinceLabel = formatPairedSince(pairedSince);

  return (
    <View style={styles.container}>
      <View style={styles.avatarsRow}>
        <View style={styles.avatarWrapper}>
          <View style={[styles.avatar, styles.avatarSelf]}>
            <Text style={styles.avatarLetter}>{initial(myName)}</Text>
          </View>
          <Text style={styles.avatarLabel}>You</Text>
        </View>

        <View style={styles.connector}>
          <View style={styles.connectorLine} />
          <View style={styles.connectorBadge}>
            <Ionicons name="flash" size={14} color={colors.primary} />
          </View>
          <View style={styles.connectorLine} />
        </View>

        <View style={styles.avatarWrapper}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>{initial(buddyName)}</Text>
          </View>
          <Text style={styles.avatarLabel} numberOfLines={1}>
            {buddyName}
          </Text>
        </View>
      </View>

      <Text style={styles.buddyName} numberOfLines={1}>
        {buddyName}
      </Text>

      <View style={styles.levelRow}>
        <View style={styles.levelBadge}>
          <Text style={styles.levelBadgeText}>LEVEL {buddyLevel}</Text>
        </View>
      </View>

      {sinceLabel && <Text style={styles.sinceLabel}>{sinceLabel}</Text>}
    </View>
  );
}

const AVATAR_SIZE = 64;

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: spacing.cardRadius,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: spacing.sm,
  },
  avatarWrapper: {
    alignItems: 'center',
    gap: spacing.xs,
    width: 80,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.primaryDim,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSelf: {
    borderColor: 'rgba(16,185,129,0.45)',
  },
  avatarLetter: {
    fontFamily: fonts.bold,
    fontSize: 26,
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  avatarLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textTertiary,
    letterSpacing: 0.3,
    maxWidth: 80,
  },
  connector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.sm,
    marginBottom: 18,
  },
  connectorLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(16,185,129,0.35)',
  },
  connectorBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
  },
  buddyName: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: colors.textPrimary,
    letterSpacing: 0.3,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  levelBadge: {
    backgroundColor: colors.primaryDim,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
  },
  levelBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.primary,
    letterSpacing: 1.2,
  },
  sinceLabel: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textTertiary,
    letterSpacing: 0.2,
    marginTop: spacing.xs,
  },
});
