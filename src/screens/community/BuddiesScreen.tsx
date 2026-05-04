import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../navigation/CommunityNavigator';
import {
  getBuddies,
  getPendingIncoming,
  acceptBuddyRequest,
  declineBuddyRequest,
  type BuddyRequest,
} from '../../services/buddyService';
import type { CommunityProfile } from '../../services/communityService';
import { colors, fonts, spacing } from '../../theme';

type Props = NativeStackScreenProps<CommunityStackParamList, 'Buddies'>;

export default function BuddiesScreen({ navigation }: Props) {
  const [buddies, setBuddies] = useState<CommunityProfile[]>([]);
  const [incoming, setIncoming] = useState<BuddyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [b, i] = await Promise.all([getBuddies(), getPendingIncoming()]);
    setBuddies(b);
    setIncoming(i);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const accept = async (req: BuddyRequest) => {
    setRespondingId(req.id);
    await acceptBuddyRequest(req.id);
    setIncoming((prev) => prev.filter((r) => r.id !== req.id));
    if (req.profile) setBuddies((prev) => [...prev, req.profile!]);
    setRespondingId(null);
  };

  const decline = async (req: BuddyRequest) => {
    setRespondingId(req.id);
    await declineBuddyRequest(req.id);
    setIncoming((prev) => prev.filter((r) => r.id !== req.id));
    setRespondingId(null);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header onBack={() => navigation.goBack()} />
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />
      </SafeAreaView>
    );
  }

  const hasContent = buddies.length > 0 || incoming.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header onBack={() => navigation.goBack()} />

      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={
          <>
            {/* Incoming requests */}
            {incoming.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                  BUDDY REQUESTS ({incoming.length})
                </Text>
                {incoming.map((req) => (
                  <RequestCard
                    key={req.id}
                    request={req}
                    loading={respondingId === req.id}
                    onAccept={() => accept(req)}
                    onDecline={() => decline(req)}
                    onPress={() => req.profile && navigation.navigate('UserProfile', { userId: req.profile.id })}
                  />
                ))}
              </View>
            )}

            {/* Buddy list */}
            <View style={styles.section}>
              {buddies.length > 0 && (
                <Text style={styles.sectionLabel}>
                  YOUR BUDDIES ({buddies.length})
                </Text>
              )}
              {buddies.map((buddy) => (
                <BuddyCard
                  key={buddy.id}
                  profile={buddy}
                  onPress={() => navigation.navigate('UserProfile', { userId: buddy.id })}
                />
              ))}
            </View>

            {/* Empty state */}
            {!hasContent && <EmptyState onDiscover={() => navigation.navigate('Discover')} />}
          </>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={12}>
        <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
      </Pressable>
      <Text style={styles.headerTitle}>Buddies</Text>
      <View style={{ width: 24 }} />
    </View>
  );
}

function RequestCard({
  request,
  loading,
  onAccept,
  onDecline,
  onPress,
}: {
  request: BuddyRequest;
  loading: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onPress: () => void;
}) {
  const profile = request.profile;
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
      onPress={onPress}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarLetter}>
          {(profile?.name ?? 'R').charAt(0).toUpperCase()}
        </Text>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={1}>
          {profile?.name ?? 'Unknown Runner'}
        </Text>
        <View style={styles.cardMeta}>
          <MetaPill icon="trending-up-outline" label={`Lvl ${profile?.level ?? '?'}`} />
          <MetaPill icon="flame-outline" label={`${profile?.currentStreak ?? 0}d`} />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <View style={styles.requestActions}>
          <Pressable
            style={({ pressed }) => [styles.acceptBtn, pressed && { opacity: 0.75 }]}
            onPress={onAccept}
          >
            <Text style={styles.acceptBtnText}>Accept</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.declineBtn, pressed && { opacity: 0.75 }]}
            onPress={onDecline}
          >
            <Text style={styles.declineBtnText}>Decline</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

function BuddyCard({
  profile,
  onPress,
}: {
  profile: CommunityProfile;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
      onPress={onPress}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarLetter}>
          {profile.name.charAt(0).toUpperCase()}
        </Text>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={1}>{profile.name}</Text>
        <View style={styles.cardMeta}>
          <MetaPill icon="trending-up-outline" label={`Lvl ${profile.level}`} />
          <MetaPill icon="flame-outline" label={`${profile.currentStreak}d streak`} />
          <MetaPill icon="walk-outline" label={`${profile.totalSessions} sessions`} />
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
    </Pressable>
  );
}

function MetaPill({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.metaPill}>
      <Ionicons name={icon} size={11} color={colors.textSecondary} />
      <Text style={styles.metaPillText}>{label}</Text>
    </View>
  );
}

function EmptyState({ onDiscover }: { onDiscover: () => void }) {
  return (
    <View style={styles.emptyWrapper}>
      <View style={styles.emptyIconRing}>
        <Ionicons name="people-outline" size={32} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>No buddies yet</Text>
      <Text style={styles.emptySub}>
        Find runners at your level and send them a buddy request from their profile.
      </Text>
      <Pressable
        style={({ pressed }) => [styles.discoverBtn, pressed && { opacity: 0.85 }]}
        onPress={onDiscover}
      >
        <Text style={styles.discoverBtnText}>Find Runners</Text>
      </Pressable>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 14,
  },
  headerTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 17,
    color: colors.textPrimary,
  },
  listContent: {
    paddingBottom: 32,
  },
  section: {
    paddingHorizontal: spacing.screenPadding,
    gap: 10,
    marginBottom: 24,
  },
  sectionLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.primary,
  },
  cardBody: {
    flex: 1,
    gap: 5,
  },
  cardName: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  cardMeta: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaPillText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  acceptBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: '#fff',
  },
  declineBtn: {
    backgroundColor: 'transparent',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  declineBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  emptyWrapper: {
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 48,
    gap: 12,
  },
  emptyIconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.textPrimary,
  },
  emptySub: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  discoverBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  discoverBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: '#fff',
  },
});
