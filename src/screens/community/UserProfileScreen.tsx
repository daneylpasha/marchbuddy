import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
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
  acceptBuddyRequest,
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
    Promise.all([
      getUserProfile(userId),
      isFollowing(userId),
      getBuddyStatus(userId),
    ]).then(([p, f, b]) => {
      setProfile(p);
      setFollowing(f);
      setBuddyStatus(b);
      setLoading(false);
    });
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

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar + name */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>
              {profile.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name}>{profile.name}</Text>

          {/* Level badge */}
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeText}>LEVEL {profile.level}</Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatBox value={profile.currentStreak} label="Day Streak" icon="flame-outline" />
          <View style={styles.statsDivider} />
          <StatBox value={profile.totalSessions} label="Sessions" icon="walk-outline" />
          <View style={styles.statsDivider} />
          <StatBox
            value={profile.totalDistanceKm.toFixed(1)}
            label="km Total"
            icon="map-outline"
          />
        </View>

        {profile.winPoints > 0 && (
          <View style={styles.winPointsCard}>
            <Ionicons name="trophy-outline" size={18} color="#F59E0B" />
            <Text style={styles.winPointsText}>
              {profile.winPoints} challenge win{profile.winPoints !== 1 ? 's' : ''}
            </Text>
          </View>
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
      <View style={[styles.buddyBtnDisabled, { opacity: 1 }]}>
        <Ionicons name="people-outline" size={18} color={colors.textSecondary} />
        <Text style={styles.buddyBtnText}>
          Buddy up unlocks within 2 levels of each other
        </Text>
      </View>
    );
  }

  if (status === 'accepted') {
    return (
      <View style={[styles.buddyBtnDisabled, { opacity: 1, borderColor: 'rgba(16,185,129,0.3)' }]}>
        <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
        <Text style={[styles.buddyBtnText, { color: colors.primary }]}>MarchBuddies</Text>
      </View>
    );
  }

  const config = {
    none:             { label: 'Send Buddy Request', icon: 'people-outline' as const, active: true },
    pending_sent:     { label: 'Request Sent — Cancel?', icon: 'time-outline' as const, active: false },
    pending_received: { label: 'Accept Buddy Request', icon: 'people-outline' as const, active: true },
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
          <Text style={[styles.buddyBtnActiveText, !config.active && { color: colors.textSecondary }]}>
            {config.label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

function StatBox({
  value,
  label,
  icon,
}: {
  value: number | string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.statBox}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
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
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 18,
    paddingVertical: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statsDivider: {
    width: 1,
    backgroundColor: colors.surfaceBorder,
  },
  statValue: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.textPrimary,
  },
  statLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 0.3,
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
  buddyBtnDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 16,
    borderRadius: 14,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    opacity: 0.6,
  },
  buddyBtnText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    flex: 1,
  },
  notFound: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 60,
  },
});
