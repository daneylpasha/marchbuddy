import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../navigation/CommunityNavigator';
import {
  getMyActiveChallenge,
  getPendingInvites,
  getChallengeHistory,
  acceptChallenge,
  declineChallenge,
  type Challenge,
  type ChallengeWithScores,
} from '../../services/challengeService';
import { colors, fonts, spacing } from '../../theme';

type Props = NativeStackScreenProps<CommunityStackParamList, 'Challenges'>;

export default function ChallengesScreen({ navigation }: Props) {
  const [active, setActive] = useState<ChallengeWithScores | null>(null);
  const [pending, setPending] = useState<Challenge[]>([]);
  const [history, setHistory] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [a, p, h] = await Promise.all([
      getMyActiveChallenge(),
      getPendingInvites(),
      getChallengeHistory(),
    ]);
    setActive(a);
    setPending(p);
    setHistory(h);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAccept = async (challenge: Challenge) => {
    setRespondingId(challenge.id);
    try {
      await acceptChallenge(challenge.id);
      setPending((prev) => prev.filter((c) => c.id !== challenge.id));
      load(); // reload to get active challenge with scores
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to accept.');
    } finally {
      setRespondingId(null);
    }
  };

  const handleDecline = async (challenge: Challenge) => {
    Alert.alert(
      'Decline Challenge',
      `Decline the challenge from ${challenge.isMyTeamA ? challenge.teamBName : challenge.teamAName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setRespondingId(challenge.id);
            await declineChallenge(challenge.id);
            setPending((prev) => prev.filter((c) => c.id !== challenge.id));
            setRespondingId(null);
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header onBack={() => navigation.goBack()} />
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />
      </SafeAreaView>
    );
  }

  const hasContent = !!active || pending.length > 0 || history.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header onBack={() => navigation.goBack()} />

      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={
          <>
            {/* Active challenge */}
            {active && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>ACTIVE CHALLENGE</Text>
                <ActiveCard
                  challenge={active}
                  onPress={() => navigation.navigate('ActiveChallenge', { challengeId: active.id })}
                />
              </View>
            )}

            {/* Pending invites */}
            {pending.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>INVITES ({pending.length})</Text>
                {pending.map((c) => (
                  <InviteCard
                    key={c.id}
                    challenge={c}
                    loading={respondingId === c.id}
                    onAccept={() => handleAccept(c)}
                    onDecline={() => handleDecline(c)}
                  />
                ))}
              </View>
            )}

            {/* History */}
            {history.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>HISTORY</Text>
                {history.map((c) => (
                  <HistoryCard
                    key={c.id}
                    challenge={c}
                    onPress={() => navigation.navigate('ActiveChallenge', { challengeId: c.id })}
                  />
                ))}
              </View>
            )}

            {!hasContent && <EmptyState />}
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
      <Text style={styles.headerTitle}>Challenges</Text>
      <View style={{ width: 24 }} />
    </View>
  );
}

function ActiveCard({
  challenge,
  onPress,
}: {
  challenge: ChallengeWithScores;
  onPress: () => void;
}) {
  const myScore = challenge.isMyTeamA ? challenge.teamAParamWins : challenge.teamBParamWins;
  const theirScore = challenge.isMyTeamA ? challenge.teamBParamWins : challenge.teamAParamWins;
  const myName = challenge.isMyTeamA ? challenge.teamAName : challenge.teamBName;
  const theirName = challenge.isMyTeamA ? challenge.teamBName : challenge.teamAName;

  const daysLeft = challenge.endsAt
    ? Math.max(0, Math.ceil((new Date(challenge.endsAt).getTime() - Date.now()) / 86400000))
    : null;

  return (
    <Pressable
      style={({ pressed }) => [styles.activeCard, pressed && { opacity: 0.9 }]}
      onPress={onPress}
    >
      <View style={styles.activeCardTop}>
        <Text style={styles.activeLabel}>LIVE</Text>
        {daysLeft !== null && (
          <Text style={styles.daysLeft}>{daysLeft}d left</Text>
        )}
      </View>
      <View style={styles.scoreRow}>
        <View style={styles.scoreTeam}>
          <Text style={styles.scoreTeamName} numberOfLines={1}>{myName}</Text>
          <Text style={styles.scoreValue}>{myScore}</Text>
        </View>
        <Text style={styles.scoreVs}>VS</Text>
        <View style={[styles.scoreTeam, { alignItems: 'flex-end' }]}>
          <Text style={styles.scoreTeamName} numberOfLines={1}>{theirName}</Text>
          <Text style={styles.scoreValue}>{theirScore}</Text>
        </View>
      </View>
      <Text style={styles.activeCardSub}>Best of 3 · Tap for live scores</Text>
    </Pressable>
  );
}

function InviteCard({
  challenge,
  loading,
  onAccept,
  onDecline,
}: {
  challenge: Challenge;
  loading: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const opponent = challenge.isMyTeamA ? challenge.teamBName : challenge.teamAName;
  const isSender = challenge.isMyTeamA;

  return (
    <View style={styles.inviteCard}>
      <View style={styles.inviteCardLeft}>
        <Ionicons name="flash-outline" size={20} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.inviteCardName}>{opponent}</Text>
          <Text style={styles.inviteCardSub}>
            {isSender ? 'Awaiting their response' : 'Wants to challenge your team'}
          </Text>
        </View>
      </View>
      {!isSender && (
        loading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <View style={styles.inviteActions}>
            <Pressable
              style={({ pressed }) => [styles.acceptBtn, pressed && { opacity: 0.8 }]}
              onPress={onAccept}
            >
              <Text style={styles.acceptBtnText}>Accept</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.declineBtn, pressed && { opacity: 0.8 }]}
              onPress={onDecline}
            >
              <Text style={styles.declineBtnText}>Decline</Text>
            </Pressable>
          </View>
        )
      )}
    </View>
  );
}

function HistoryCard({
  challenge,
  onPress,
}: {
  challenge: Challenge;
  onPress: () => void;
}) {
  const myName = challenge.isMyTeamA ? challenge.teamAName : challenge.teamBName;
  const opponent = challenge.isMyTeamA ? challenge.teamBName : challenge.teamAName;
  const didWin = challenge.winnerTeamId === challenge.myTeamId;
  const isDraw = challenge.status === 'completed' && !challenge.winnerTeamId;

  const resultColor = isDraw ? colors.textSecondary : didWin ? '#10B981' : '#EF4444';
  const resultLabel = challenge.status === 'declined'
    ? 'Declined'
    : challenge.status === 'expired'
    ? 'Expired'
    : isDraw ? 'Draw' : didWin ? 'Won' : 'Lost';

  return (
    <Pressable
      style={({ pressed }) => [styles.historyCard, pressed && { opacity: 0.85 }]}
      onPress={onPress}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.historyOpponent} numberOfLines={1}>
          {myName} vs {opponent}
        </Text>
        <Text style={styles.historySub}>{challenge.mode}</Text>
      </View>
      <Text style={[styles.historyResult, { color: resultColor }]}>{resultLabel}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
    </Pressable>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyWrapper}>
      <View style={styles.emptyIconRing}>
        <Ionicons name="flash-outline" size={32} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>No challenges yet</Text>
      <Text style={styles.emptySub}>
        Find rival teams and send them a challenge to kick things off.
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 14,
  },
  headerTitle: { fontFamily: fonts.semiBold, fontSize: 17, color: colors.textPrimary },
  listContent: { paddingBottom: 40 },
  section: {
    paddingHorizontal: spacing.screenPadding,
    gap: 10,
    marginBottom: 28,
  },
  sectionLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.textSecondary,
    marginBottom: 2,
  },

  // Active card
  activeCard: {
    backgroundColor: colors.primaryDim,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    gap: 12,
  },
  activeCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.primary,
    backgroundColor: 'rgba(16,185,129,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  daysLeft: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoreTeam: { flex: 1, gap: 4 },
  scoreTeamName: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  scoreValue: {
    fontFamily: fonts.bold,
    fontSize: 40,
    color: colors.textPrimary,
    lineHeight: 48,
  },
  scoreVs: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textSecondary,
    paddingHorizontal: 12,
  },
  activeCardSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Invite card
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  inviteCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  inviteCardName: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.textPrimary },
  inviteCardSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  inviteActions: { flexDirection: 'row', gap: 8 },
  acceptBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  acceptBtnText: { fontFamily: fonts.semiBold, fontSize: 13, color: '#fff' },
  declineBtn: {
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  declineBtnText: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.textSecondary },

  // History card
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  historyOpponent: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.textPrimary },
  historySub: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  historyResult: { fontFamily: fonts.bold, fontSize: 14 },

  // Empty
  emptyWrapper: {
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 64,
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
  emptyTitle: { fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary },
  emptySub: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
});
