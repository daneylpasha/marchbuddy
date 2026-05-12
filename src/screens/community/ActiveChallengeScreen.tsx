import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../navigation/CommunityNavigator';
import {
  getChallengeWithScores,
  subscribeToChallengeProgress,
  type ChallengeWithScores,
  type TeamScore,
  type MemberProgress,
} from '../../services/challengeService';
import { colors, fonts, spacing } from '../../theme';

type Props = NativeStackScreenProps<CommunityStackParamList, 'ActiveChallenge'>;

export default function ActiveChallengeScreen({ navigation, route }: Props) {
  const { challengeId } = route.params;
  const [challenge, setChallenge] = useState<ChallengeWithScores | null>(null);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const load = useCallback(async () => {
    const c = await getChallengeWithScores(challengeId);
    setChallenge(c);
    setLoading(false);
  }, [challengeId]);

  useEffect(() => {
    load();

    channelRef.current = subscribeToChallengeProgress(challengeId, () => {
      load();
    });

    return () => {
      channelRef.current?.unsubscribe();
    };
  }, [challengeId, load]);

  if (loading || !challenge) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header onBack={() => navigation.goBack()} title="Challenge" />
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />
      </SafeAreaView>
    );
  }

  const myTeam = challenge.isMyTeamA ? challenge.teamA : challenge.teamB;
  const theirTeam = challenge.isMyTeamA ? challenge.teamB : challenge.teamA;
  const myParamWins = challenge.isMyTeamA ? challenge.teamAParamWins : challenge.teamBParamWins;
  const theirParamWins = challenge.isMyTeamA ? challenge.teamBParamWins : challenge.teamAParamWins;
  const isCompleted = challenge.status === 'completed';
  const didWin = challenge.winnerTeamId === challenge.myTeamId;

  const daysLeft =
    challenge.endsAt && challenge.status === 'active'
      ? Math.max(0, Math.ceil((new Date(challenge.endsAt).getTime() - Date.now()) / 86400000))
      : null;

  const durationDays =
    challenge.endsAt && challenge.startsAt
      ? Math.round(
          (new Date(challenge.endsAt).getTime() - new Date(challenge.startsAt).getTime()) /
            86400000,
        )
      : 7;

  const paramResults = computeParamResults(challenge.teamA, challenge.teamB, durationDays);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        onBack={() => navigation.goBack()}
        title={`${challenge.teamAName} vs ${challenge.teamBName}`}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Result banner (completed) */}
        {isCompleted && (
          <View
            style={[styles.resultBanner, didWin ? styles.resultBannerWin : styles.resultBannerLoss]}
          >
            <Ionicons
              name={didWin ? 'trophy' : 'close-circle'}
              size={24}
              color={didWin ? '#F59E0B' : '#EF4444'}
            />
            <Text style={[styles.resultBannerText, { color: didWin ? '#F59E0B' : '#EF4444' }]}>
              {!challenge.winnerTeamId ? 'Draw' : didWin ? 'Your team won!' : 'Your team lost'}
            </Text>
          </View>
        )}

        {/* Score overview */}
        <View style={styles.scoreboard}>
          <ScoreCol name={myTeam.teamName} wins={myParamWins} isMe />
          <View style={styles.scoreboardCenter}>
            <Text style={styles.vsBig}>VS</Text>
            {daysLeft !== null && <Text style={styles.daysLeftText}>{daysLeft}d left</Text>}
            {challenge.status === 'active' && <View style={styles.liveDot} />}
          </View>
          <ScoreCol name={theirTeam.teamName} wins={theirParamWins} isMe={false} />
        </View>

        {/* Parameters breakdown */}
        <Text style={styles.sectionLabel}>PARAMETERS</Text>
        {paramResults.map((param) => (
          <ParamRow key={param.label} param={param} />
        ))}

        {/* Team A members */}
        <Text style={styles.sectionLabel}>{challenge.teamAName.toUpperCase()}</Text>
        {challenge.teamA.members.map((m) => (
          <MemberRow key={m.userId} member={m} />
        ))}

        {/* Team B members */}
        <Text style={styles.sectionLabel}>{challenge.teamBName.toUpperCase()}</Text>
        {challenge.teamB.members.map((m) => (
          <MemberRow key={m.userId} member={m} />
        ))}

        {/* Win points note */}
        {isCompleted && challenge.winnerTeamId && (
          <View style={styles.winPointsNote}>
            <Ionicons name="trophy-outline" size={16} color="#F59E0B" />
            <Text style={styles.winPointsNoteText}>
              {didWin
                ? 'Your team earned +1 win point each.'
                : 'The winning team earned +1 win point each.'}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Parameter computation ────────────────────────────────────────────────────

interface ParamResult {
  label: string;
  aValue: string;
  bValue: string;
  winner: 'a' | 'b' | 'draw';
}

function computeParamResults(
  teamA: TeamScore,
  teamB: TeamScore,
  durationDays: number,
): ParamResult[] {
  const expectedSessions = durationDays;
  const memberCountA = teamA.members.length || 1;
  const memberCountB = teamB.members.length || 1;

  const aCompletion =
    teamA.members.reduce((s, m) => s + m.sessionsCompleted, 0) / (expectedSessions * memberCountA);
  const bCompletion =
    teamB.members.reduce((s, m) => s + m.sessionsCompleted, 0) / (expectedSessions * memberCountB);
  const aStreak = teamA.members.reduce((s, m) => s + m.currentStreak, 0);
  const bStreak = teamB.members.reduce((s, m) => s + m.currentStreak, 0);
  const aVolume = teamA.members.reduce((s, m) => s + m.totalMinutes, 0);
  const bVolume = teamB.members.reduce((s, m) => s + m.totalMinutes, 0);

  const winner = (a: number, b: number): 'a' | 'b' | 'draw' => (a > b ? 'a' : b > a ? 'b' : 'draw');

  return [
    {
      label: 'Completion Rate',
      aValue: `${(aCompletion * 100).toFixed(0)}%`,
      bValue: `${(bCompletion * 100).toFixed(0)}%`,
      winner: winner(aCompletion, bCompletion),
    },
    {
      label: 'Combined Streak',
      aValue: `${aStreak}d`,
      bValue: `${bStreak}d`,
      winner: winner(aStreak, bStreak),
    },
    {
      label: 'Total Volume',
      aValue: `${Math.round(aVolume)}m`,
      bValue: `${Math.round(bVolume)}m`,
      winner: winner(aVolume, bVolume),
    },
  ];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Header({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={12}>
        <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={{ width: 24 }} />
    </View>
  );
}

function ScoreCol({ name, wins, isMe }: { name: string; wins: number; isMe: boolean }) {
  return (
    <View style={[styles.scoreCol, isMe && styles.scoreColMe]}>
      <Text style={styles.scoreColName} numberOfLines={2}>
        {name}
      </Text>
      <Text style={styles.scoreColValue}>{wins}</Text>
      <Text style={styles.scoreColSub}>params won</Text>
    </View>
  );
}

function ParamRow({ param }: { param: ParamResult }) {
  const aHighlight = param.winner === 'a';
  const bHighlight = param.winner === 'b';

  return (
    <View style={styles.paramRow}>
      <Text style={[styles.paramValue, aHighlight && styles.paramValueWin]}>{param.aValue}</Text>
      <Text style={styles.paramLabel}>{param.label}</Text>
      <Text style={[styles.paramValue, bHighlight && styles.paramValueWin, { textAlign: 'right' }]}>
        {param.bValue}
      </Text>
    </View>
  );
}

function MemberRow({ member }: { member: MemberProgress }) {
  return (
    <View style={styles.memberRow}>
      <View style={styles.memberAvatar}>
        <Text style={styles.memberAvatarLetter}>{member.profile.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.memberBody}>
        <Text style={styles.memberName} numberOfLines={1}>
          {member.profile.name}
        </Text>
        <Text style={styles.memberMeta}>Lvl {member.profile.level}</Text>
      </View>
      <View style={styles.memberStats}>
        <StatChip icon="walk-outline" label={`${member.sessionsCompleted} sessions`} />
        <StatChip icon="flame-outline" label={`${member.currentStreak}d`} />
        <StatChip icon="time-outline" label={`${Math.round(member.totalMinutes)}m`} />
      </View>
    </View>
  );
}

function StatChip({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.statChip}>
      <Ionicons name={icon} size={11} color={colors.textSecondary} />
      <Text style={styles.statChipText}>{label}</Text>
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
  headerTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  content: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 48,
    gap: 16,
  },

  // Result banner
  resultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  resultBannerWin: {
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderColor: 'rgba(245,158,11,0.3)',
  },
  resultBannerLoss: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderColor: 'rgba(239,68,68,0.2)',
  },
  resultBannerText: { fontFamily: fonts.bold, fontSize: 16 },

  // Scoreboard
  scoreboard: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
  },
  scoreCol: { flex: 1, alignItems: 'center', gap: 4 },
  scoreColMe: {},
  scoreColName: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  scoreColValue: {
    fontFamily: fonts.bold,
    fontSize: 48,
    color: colors.textPrimary,
    lineHeight: 56,
  },
  scoreColSub: { fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary },
  scoreboardCenter: { alignItems: 'center', gap: 6, paddingHorizontal: 12 },
  vsBig: { fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary },
  daysLeftText: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },

  // Parameters
  sectionLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.textSecondary,
    marginTop: 4,
  },
  paramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  paramValue: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textSecondary,
    width: 70,
  },
  paramValueWin: { color: colors.primary },
  paramLabel: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Member rows
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarLetter: { fontFamily: fonts.bold, fontSize: 15, color: colors.primary },
  memberBody: { width: 80, gap: 2 },
  memberName: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.textPrimary },
  memberMeta: { fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary },
  memberStats: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  statChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statChipText: { fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary },

  // Win points note
  winPointsNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
  },
  winPointsNoteText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: '#F59E0B',
    flex: 1,
  },
});
