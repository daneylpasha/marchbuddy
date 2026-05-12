import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../navigation/CommunityNavigator';
import {
  getUserProfile,
  isFollowing,
  followUser,
  unfollowUser,
  type CommunityProfile,
} from '../../services/communityService';
import {
  getBuddyStatus,
  sendBuddyRequest,
  cancelBuddyRequest,
  levelsCompatible,
  type BuddyStatus,
} from '../../services/buddyService';
import { useRunProgressStore } from '../../store/runProgressStore';
import { colors, fonts, spacing } from '../../theme';

type Props = NativeStackScreenProps<CommunityStackParamList, 'UserProfile'>;

export default function UserProfileScreen({ navigation, route }: Props) {
  const { userId } = route.params;
  const myLevel = useRunProgressStore((s) => s.progress?.currentLevel ?? 1);

  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [following, setFollowing] = useState(false);
  const [buddyStatus, setBuddyStatus] = useState<BuddyStatus>('none');
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [buddyLoading, setBuddyLoading] = useState(false);

  useEffect(() => {
    Promise.all([getUserProfile(userId), isFollowing(userId), getBuddyStatus(userId)]).then(
      ([p, f, b]) => {
        setProfile(p);
        setFollowing(f);
        setBuddyStatus(b);
        setLoading(false);
      },
    );
  }, [userId]);

  const toggleFollow = async () => {
    if (!profile) return;
    setFollowLoading(true);
    if (following) {
      await unfollowUser(profile.id);
      setFollowing(false);
    } else {
      await followUser(profile.id);
      setFollowing(true);
    }
    setFollowLoading(false);
  };

  const handleBuddyAction = async () => {
    if (!profile) return;
    setBuddyLoading(true);
    if (buddyStatus === 'none') {
      await sendBuddyRequest(profile.id);
      setBuddyStatus('pending_sent');
    } else if (buddyStatus === 'pending_sent') {
      await cancelBuddyRequest(profile.id);
      setBuddyStatus('none');
    } else if (buddyStatus === 'pending_received') {
      // Find and accept — we don't have the requestId here, so navigate to Buddies
      navigation.navigate('Buddies');
    }
    setBuddyLoading(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.backRow}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </Pressable>
        </View>
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.backRow}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </Pressable>
        </View>
        <Text style={styles.notFound}>Profile not found or not visible.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.backRow}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Avatar + name */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>{profile.name.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{profile.name}</Text>

          {/* Level badge */}
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeText}>LEVEL {profile.level}</Text>
          </View>
        </View>

        {profile.discoverable === false ? (
          <View style={styles.privateCard}>
            <Ionicons name="lock-closed-outline" size={22} color={colors.textSecondary} />
            <Text style={styles.privateTitle}>Private Profile</Text>
            <Text style={styles.privateSubtitle}>{profile.name} has hidden their details.</Text>
          </View>
        ) : (
          <>
            {/* Hero streak — matches Progress screen */}
            <View style={styles.heroStreakSection}>
              <Text style={styles.heroFlame}>🔥</Text>
              <Text style={styles.heroStreakValue}>{profile.currentStreak}</Text>
              <Text style={styles.heroStreakLabel}>DAY STREAK</Text>
              {(profile.bestStreakDays ?? 0) > 0 && (
                <Text style={styles.heroBestStreak}>Best: {profile.bestStreakDays} days</Text>
              )}
            </View>

            {/* Stats row: Sessions / Total km / Best Streak */}
            <View style={styles.bigStatsRow}>
              <View style={styles.bigStatItem}>
                <Text style={styles.bigStatValue}>{profile.totalSessions}</Text>
                <Text style={styles.bigStatLabel}>Sessions</Text>
              </View>
              <View style={styles.bigStatDivider} />
              <View style={styles.bigStatItem}>
                <Text style={styles.bigStatValue}>{profile.totalDistanceKm.toFixed(1)}</Text>
                <Text style={styles.bigStatLabel}>Total km</Text>
              </View>
              <View style={styles.bigStatDivider} />
              <View style={styles.bigStatItem}>
                <Text style={styles.bigStatValue}>{profile.bestStreakDays ?? 0}</Text>
                <Text style={styles.bigStatLabel}>Best Streak</Text>
              </View>
            </View>

            {/* Secondary meta row */}
            {((profile.longestRunMinutes ?? 0) > 0 ||
              (profile.totalDurationMinutes ?? 0) > 0 ||
              profile.lastSessionDate) && (
              <View style={styles.metaRow}>
                {(profile.longestRunMinutes ?? 0) > 0 && (
                  <View style={styles.metaItem}>
                    <Ionicons name="trending-up-outline" size={14} color={colors.primary} />
                    <Text style={styles.metaValue}>{profile.longestRunMinutes}m</Text>
                    <Text style={styles.metaLabel}>Longest</Text>
                  </View>
                )}
                {(profile.totalDurationMinutes ?? 0) > 0 && (
                  <View style={styles.metaItem}>
                    <Ionicons name="time-outline" size={14} color={colors.primary} />
                    <Text style={styles.metaValue}>
                      {formatDuration(profile.totalDurationMinutes!)}
                    </Text>
                    <Text style={styles.metaLabel}>Active Time</Text>
                  </View>
                )}
                {profile.lastSessionDate && (
                  <View style={styles.metaItem}>
                    <Ionicons name="calendar-outline" size={14} color={colors.primary} />
                    <Text style={styles.metaValue}>
                      {formatRelativeDate(profile.lastSessionDate)}
                    </Text>
                    <Text style={styles.metaLabel}>Last Active</Text>
                  </View>
                )}
              </View>
            )}

            {profile.winPoints > 0 && (
              <View style={styles.winPointsCard}>
                <Ionicons name="trophy-outline" size={18} color="#F59E0B" />
                <Text style={styles.winPointsText}>
                  {profile.winPoints} challenge win{profile.winPoints !== 1 ? 's' : ''}
                </Text>
              </View>
            )}
          </>
        )}

        {/* Actions */}
        <Pressable
          style={({ pressed }) => [
            styles.followBtn,
            following && styles.followBtnActive,
            pressed && { opacity: 0.8 },
          ]}
          onPress={toggleFollow}
          disabled={followLoading}
        >
          {followLoading ? (
            <ActivityIndicator color={following ? colors.textSecondary : '#fff'} />
          ) : (
            <>
              <Ionicons
                name={following ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={following ? colors.textSecondary : '#fff'}
              />
              <Text style={[styles.followBtnText, following && styles.followBtnTextActive]}>
                {following ? 'Stop Marching' : 'Bench March'}
              </Text>
            </>
          )}
        </Pressable>

        <BuddyButton
          myLevel={myLevel}
          theirLevel={profile.level}
          status={buddyStatus}
          loading={buddyLoading}
          onPress={handleBuddyAction}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function BuddyButton({
  myLevel,
  theirLevel,
  status,
  loading,
  onPress,
}: {
  myLevel: number;
  theirLevel: number;
  status: BuddyStatus;
  loading: boolean;
  onPress: () => void;
}) {
  const compatible = levelsCompatible(myLevel, theirLevel);

  if (!compatible) {
    return (
      <View style={styles.buddyLocked}>
        <Ionicons name="lock-closed-outline" size={16} color={colors.textTertiary} />
        <Text style={styles.buddyLockedText}>Buddy up unlocks within 2 levels</Text>
      </View>
    );
  }

  if (status === 'accepted') {
    return (
      <View style={styles.buddyConnected}>
        <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
        <Text style={styles.buddyConnectedText}>MarchBuddies</Text>
      </View>
    );
  }

  const config = {
    none: { label: 'Send Buddy Request', icon: 'people-outline' as const, active: true },
    pending_sent: { label: 'Request Sent — Cancel?', icon: 'time-outline' as const, active: false },
    pending_received: {
      label: 'Accept Buddy Request',
      icon: 'people-outline' as const,
      active: true,
    },
  }[status];

  return (
    <Pressable
      style={({ pressed }) => [
        styles.buddyBtn,
        !config.active && styles.buddyBtnPending,
        pressed && { opacity: 0.8 },
      ]}
      onPress={onPress}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color={config.active ? '#fff' : colors.textSecondary} />
      ) : (
        <>
          <Ionicons
            name={config.icon}
            size={18}
            color={config.active ? '#fff' : colors.textSecondary}
          />
          <Text
            style={[styles.buddyBtnActiveText, !config.active && { color: colors.textSecondary }]}
          >
            {config.label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining === 0 ? `${hours}h` : `${hours}h ${remaining}m`;
}

function formatRelativeDate(dateStr: string): string {
  const then = new Date(dateStr);
  const now = new Date();
  const days = Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return then.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backRow: {
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 14,
  },
  content: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 40,
    alignItems: 'center',
    gap: 16,
  },
  profileHeader: {
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  avatarLetter: {
    fontFamily: fonts.bold,
    fontSize: 32,
    color: colors.primary,
  },
  name: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: colors.textPrimary,
  },
  levelBadge: {
    backgroundColor: colors.primaryDim,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
  },
  levelBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.primary,
  },
  heroStreakSection: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 24,
    gap: 4,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.streak + '30',
  },
  heroFlame: {
    fontSize: 40,
    marginBottom: 4,
  },
  heroStreakValue: {
    fontFamily: fonts.titleRegular,
    fontSize: 56,
    color: colors.streak,
    letterSpacing: 1,
    lineHeight: 60,
  },
  heroStreakLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  heroBestStreak: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textTertiary,
    letterSpacing: 0.3,
    marginTop: 4,
  },
  bigStatsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 18,
    paddingVertical: 18,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  bigStatItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  bigStatValue: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  bigStatLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textTertiary,
    letterSpacing: 0.3,
  },
  bigStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  metaRow: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    justifyContent: 'space-around',
  },
  metaItem: {
    alignItems: 'center',
    gap: 3,
    flex: 1,
  },
  metaValue: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.textPrimary,
    letterSpacing: 0.2,
    marginTop: 2,
  },
  metaLabel: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.textTertiary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  winPointsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
    width: '100%',
  },
  winPointsText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: '#F59E0B',
  },
  privateCard: {
    width: '100%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 18,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  privateTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  privateSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    width: '100%',
  },
  followBtnActive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  followBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: '#fff',
  },
  followBtnTextActive: {
    color: colors.textSecondary,
  },
  buddyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    width: '100%',
  },
  buddyBtnPending: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  buddyBtnActiveText: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: '#fff',
  },
  buddyConnected: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    width: '100%',
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
  },
  buddyConnectedText: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.primary,
    letterSpacing: 0.3,
  },
  buddyLocked: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    width: '100%',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  buddyLockedText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textTertiary,
    letterSpacing: 0.2,
  },
  notFound: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 60,
  },
});
