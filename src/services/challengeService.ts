import { supabase } from '../api/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { CommunityProfile } from './communityService';

// ─── Social push helper ───────────────────────────────────────────────────────

function sendSocialPush(
  event: 'challenge_invite' | 'challenge_accepted' | 'challenge_completed',
  targetUserId: string,
  senderId: string,
  meta?: { senderTeamName?: string },
): void {
  // Fire-and-forget: never block the user on a push notification
  supabase.functions
    .invoke('send-social-push', {
      body: { event, targetUserId, senderId, meta },
    })
    .catch(() => {});
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChallengeStatus = 'invited' | 'active' | 'completed' | 'declined' | 'expired';
export type ChallengeMode = 'cooperative' | 'competitive';

export interface MemberProgress {
  userId: string;
  profile: CommunityProfile;
  sessionsCompleted: number;
  totalMinutes: number;
  currentStreak: number;
  lastSessionAt: string | null;
}

export interface TeamScore {
  teamId: string;
  teamName: string;
  completionRate: number;
  streakTotal: number;
  volumeMinutes: number;
  members: MemberProgress[];
}

export interface Challenge {
  id: string;
  teamAId: string;
  teamBId: string;
  teamAName: string;
  teamBName: string;
  status: ChallengeStatus;
  mode: ChallengeMode;
  invitedAt: string;
  acceptedAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
  winnerTeamId: string | null;
  myTeamId: string;
  isMyTeamA: boolean;
}

export interface ChallengeWithScores extends Challenge {
  teamA: TeamScore;
  teamB: TeamScore;
  // Best-of-3 parameter wins
  teamAParamWins: number;
  teamBParamWins: number;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getMyTeamId(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return null;
  const { data } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', session.user.id)
    .maybeSingle();
  return (data?.team_id as string) ?? null;
}

export async function getMyActiveChallenge(): Promise<ChallengeWithScores | null> {
  const teamId = await getMyTeamId();
  if (!teamId) return null;

  const { data: row } = await supabase
    .from('challenges')
    .select('*')
    .eq('status', 'active')
    .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
    .maybeSingle();

  if (!row) return null;
  return enrichChallenge(row, teamId);
}

export async function getPendingInvites(): Promise<Challenge[]> {
  const teamId = await getMyTeamId();
  if (!teamId) return [];

  const { data: rows } = await supabase
    .from('challenges')
    .select('*')
    .eq('status', 'invited')
    .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
    .order('invited_at', { ascending: false });

  if (!rows?.length) return [];

  const teamIds = Array.from(
    new Set(rows.flatMap((r) => [r.team_a_id as string, r.team_b_id as string])),
  );
  const { data: teams } = await supabase.from('teams').select('id, name').in('id', teamIds);
  const nameMap = new Map((teams ?? []).map((t) => [t.id as string, t.name as string]));

  return rows.map((r) => toChallenge(r, teamId, nameMap));
}

export async function getChallengeHistory(): Promise<Challenge[]> {
  const teamId = await getMyTeamId();
  if (!teamId) return [];

  const { data: rows } = await supabase
    .from('challenges')
    .select('*')
    .in('status', ['completed', 'declined', 'expired'])
    .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
    .order('updated_at', { ascending: false })
    .limit(20);

  if (!rows?.length) return [];

  const teamIds = Array.from(
    new Set(rows.flatMap((r) => [r.team_a_id as string, r.team_b_id as string])),
  );
  const { data: teams } = await supabase.from('teams').select('id, name').in('id', teamIds);
  const nameMap = new Map((teams ?? []).map((t) => [t.id as string, t.name as string]));

  return rows.map((r) => toChallenge(r, teamId, nameMap));
}

export async function getChallengeWithScores(
  challengeId: string,
): Promise<ChallengeWithScores | null> {
  const teamId = await getMyTeamId();
  if (!teamId) return null;

  const { data: row } = await supabase
    .from('challenges')
    .select('*')
    .eq('id', challengeId)
    .maybeSingle();

  if (!row) return null;
  return enrichChallenge(row, teamId);
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function sendChallenge(
  opponentTeamId: string,
  mode: ChallengeMode = 'competitive',
): Promise<Challenge> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const myTeamId = await getMyTeamId();
  if (!myTeamId) throw new Error('You must be on a team to send a challenge.');

  // Check for existing active/invited challenge between these teams
  const { data: existing } = await supabase
    .from('challenges')
    .select('id, status')
    .in('status', ['invited', 'active'])
    .or(
      `and(team_a_id.eq.${myTeamId},team_b_id.eq.${opponentTeamId}),` +
        `and(team_a_id.eq.${opponentTeamId},team_b_id.eq.${myTeamId})`,
    )
    .maybeSingle();

  if (existing) {
    if (existing.status === 'active')
      throw new Error('There is already an active challenge between these teams.');
    if (existing.status === 'invited')
      throw new Error('A challenge invite is already pending with this team.');
  }

  const { data: challenge, error } = await supabase
    .from('challenges')
    .insert({ team_a_id: myTeamId, team_b_id: opponentTeamId, mode })
    .select()
    .single();

  if (error) throw new Error(error.message);

  const teamIds = [myTeamId, opponentTeamId];
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, captain_id')
    .in('id', teamIds);

  const nameMap = new Map((teams ?? []).map((t) => [t.id as string, t.name as string]));
  const captainMap = new Map((teams ?? []).map((t) => [t.id as string, t.captain_id as string]));

  // Notify the opponent captain (fire-and-forget)
  const opponentCaptainId = captainMap.get(opponentTeamId);
  const myTeamName = nameMap.get(myTeamId);
  if (opponentCaptainId) {
    sendSocialPush('challenge_invite', opponentCaptainId, session.user.id, {
      senderTeamName: myTeamName,
    });
  }

  return toChallenge(challenge, myTeamId, nameMap);
}

export async function acceptChallenge(challengeId: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const now = new Date();
  const endsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7-day window

  // Fetch challenge to find team_a captain for notification
  const { data: challenge } = await supabase
    .from('challenges')
    .select('team_a_id, team_b_id')
    .eq('id', challengeId)
    .maybeSingle();

  const { error } = await supabase
    .from('challenges')
    .update({
      status: 'active',
      accepted_at: now.toISOString(),
      starts_at: now.toISOString(),
      ends_at: endsAt.toISOString(),
    })
    .eq('id', challengeId);

  if (error) throw new Error(error.message);

  // Seed challenge_progress rows for all team members
  await seedProgressRows(challengeId);

  // Notify the team that sent the challenge (fire-and-forget)
  if (challenge && session?.user) {
    const { data: challengerTeam } = await supabase
      .from('teams')
      .select('captain_id, name')
      .eq('id', challenge.team_a_id)
      .maybeSingle();

    const { data: myTeam } = await supabase
      .from('teams')
      .select('name')
      .eq('id', challenge.team_b_id)
      .maybeSingle();

    if (challengerTeam?.captain_id) {
      sendSocialPush('challenge_accepted', challengerTeam.captain_id as string, session.user.id, {
        senderTeamName: myTeam?.name as string | undefined,
      });
    }
  }
}

export async function declineChallenge(challengeId: string): Promise<void> {
  const { error } = await supabase
    .from('challenges')
    .update({ status: 'declined' })
    .eq('id', challengeId);

  if (error) throw new Error(error.message);
}

// Called from PostSessionScreen when environment === 'outdoor'
export async function updateProgressAfterOutdoorSession(sessionData: {
  durationMinutes: number;
}): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return;

  const teamId = await getMyTeamId();
  if (!teamId) return;

  // Find active challenge for this team
  const { data: challenge } = await supabase
    .from('challenges')
    .select('id')
    .eq('status', 'active')
    .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
    .maybeSingle();

  if (!challenge) return;

  const now = new Date().toISOString();

  // Upsert: increment sessions + minutes, update streak + last_session_at
  const { data: existing } = await supabase
    .from('challenge_progress')
    .select('sessions_completed, total_minutes, current_streak, last_session_at')
    .eq('challenge_id', challenge.id)
    .eq('user_id', session.user.id)
    .maybeSingle();

  const prev = existing ?? {
    sessions_completed: 0,
    total_minutes: 0,
    current_streak: 0,
    last_session_at: null,
  };
  const newStreak = computeNewStreak(
    prev.current_streak as number,
    prev.last_session_at as string | null,
  );

  await supabase.from('challenge_progress').upsert({
    challenge_id: challenge.id,
    user_id: session.user.id,
    team_id: teamId,
    sessions_completed: (prev.sessions_completed as number) + 1,
    total_minutes: Number(prev.total_minutes ?? 0) + sessionData.durationMinutes,
    current_streak: newStreak,
    last_session_at: now,
    updated_at: now,
  });
}

// ─── Realtime ─────────────────────────────────────────────────────────────────

export function subscribeToChallengeProgress(
  challengeId: string,
  onUpdate: () => void,
): RealtimeChannel {
  return supabase
    .channel(`challenge-${challengeId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'challenge_progress',
        filter: `challenge_id=eq.${challengeId}`,
      },
      onUpdate,
    )
    .subscribe();
}

// ─── Score calculation (best of 3 parameters) ─────────────────────────────────

export function computeScores(
  teamAProgress: MemberProgress[],
  teamBProgress: MemberProgress[],
  durationDays: number,
): { teamAWins: number; teamBWins: number } {
  const expectedSessions = durationDays; // 1 session/day target

  const scoreA = aggregateTeam(teamAProgress, expectedSessions);
  const scoreB = aggregateTeam(teamBProgress, expectedSessions);

  let teamAWins = 0;
  let teamBWins = 0;

  // Param 1: completion rate
  if (scoreA.completionRate > scoreB.completionRate) teamAWins++;
  else if (scoreB.completionRate > scoreA.completionRate) teamBWins++;

  // Param 2: combined streak
  if (scoreA.streakTotal > scoreB.streakTotal) teamAWins++;
  else if (scoreB.streakTotal > scoreA.streakTotal) teamBWins++;

  // Param 3: total volume
  if (scoreA.volumeMinutes > scoreB.volumeMinutes) teamAWins++;
  else if (scoreB.volumeMinutes > scoreA.volumeMinutes) teamBWins++;

  return { teamAWins, teamBWins };
}

function aggregateTeam(members: MemberProgress[], expectedSessions: number) {
  const memberCount = members.length || 1;
  const completionRate =
    members.reduce((s, m) => s + m.sessionsCompleted, 0) / (expectedSessions * memberCount);
  const streakTotal = members.reduce((s, m) => s + m.currentStreak, 0);
  const volumeMinutes = members.reduce((s, m) => s + m.totalMinutes, 0);
  return { completionRate, streakTotal, volumeMinutes };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toChallenge(
  row: Record<string, unknown>,
  myTeamId: string,
  nameMap: Map<string, string>,
): Challenge {
  const teamAId = row.team_a_id as string;
  const teamBId = row.team_b_id as string;
  return {
    id: row.id as string,
    teamAId,
    teamBId,
    teamAName: nameMap.get(teamAId) ?? 'Team A',
    teamBName: nameMap.get(teamBId) ?? 'Team B',
    status: row.status as ChallengeStatus,
    mode: row.mode as ChallengeMode,
    invitedAt: row.invited_at as string,
    acceptedAt: (row.accepted_at as string) ?? null,
    startsAt: (row.starts_at as string) ?? null,
    endsAt: (row.ends_at as string) ?? null,
    winnerTeamId: (row.winner_team_id as string) ?? null,
    myTeamId,
    isMyTeamA: teamAId === myTeamId,
  };
}

async function enrichChallenge(
  row: Record<string, unknown>,
  myTeamId: string,
): Promise<ChallengeWithScores> {
  const teamAId = row.team_a_id as string;
  const teamBId = row.team_b_id as string;
  const challengeId = row.id as string;

  const [{ data: teams }, { data: progressRows }] = await Promise.all([
    supabase.from('teams').select('id, name').in('id', [teamAId, teamBId]),
    supabase
      .from('challenge_progress')
      .select(
        'user_id, team_id, sessions_completed, total_minutes, current_streak, last_session_at',
      )
      .eq('challenge_id', challengeId),
  ]);

  const nameMap = new Map((teams ?? []).map((t) => [t.id as string, t.name as string]));
  const memberIds = (progressRows ?? []).map((r) => r.user_id as string);

  const { data: profiles } = memberIds.length
    ? await supabase
        .from('profiles')
        .select('id, name, level, current_streak, total_sessions, total_distance_km, win_points')
        .in('id', memberIds)
    : { data: [] };

  const profileMap = new Map((profiles ?? []).map((p) => [p.id as string, toProfile(p)]));

  const toMemberProgress = (r: Record<string, unknown>): MemberProgress => ({
    userId: r.user_id as string,
    profile: profileMap.get(r.user_id as string) ?? placeholderProfile(r.user_id as string),
    sessionsCompleted: (r.sessions_completed as number) ?? 0,
    totalMinutes: Number(r.total_minutes ?? 0),
    currentStreak: (r.current_streak as number) ?? 0,
    lastSessionAt: (r.last_session_at as string) ?? null,
  });

  const aMembers = (progressRows ?? []).filter((r) => r.team_id === teamAId).map(toMemberProgress);
  const bMembers = (progressRows ?? []).filter((r) => r.team_id === teamBId).map(toMemberProgress);

  const durationDays =
    row.ends_at && row.starts_at
      ? Math.round(
          (new Date(row.ends_at as string).getTime() -
            new Date(row.starts_at as string).getTime()) /
            86400000,
        )
      : 7;

  const aScore = aggregateTeam(aMembers, durationDays);
  const bScore = aggregateTeam(bMembers, durationDays);
  const { teamAWins, teamBWins } = computeScores(aMembers, bMembers, durationDays);

  const base = toChallenge(row, myTeamId, nameMap);

  return {
    ...base,
    teamA: {
      teamId: teamAId,
      teamName: nameMap.get(teamAId) ?? 'Team A',
      ...aScore,
      members: aMembers,
    },
    teamB: {
      teamId: teamBId,
      teamName: nameMap.get(teamBId) ?? 'Team B',
      ...bScore,
      members: bMembers,
    },
    teamAParamWins: teamAWins,
    teamBParamWins: teamBWins,
  };
}

async function seedProgressRows(challengeId: string): Promise<void> {
  const { data: challenge } = await supabase
    .from('challenges')
    .select('team_a_id, team_b_id')
    .eq('id', challengeId)
    .maybeSingle();

  if (!challenge) return;

  const { data: members } = await supabase
    .from('team_members')
    .select('user_id, team_id')
    .in('team_id', [challenge.team_a_id, challenge.team_b_id]);

  if (!members?.length) return;

  const rows = members.map((m) => ({
    challenge_id: challengeId,
    user_id: m.user_id,
    team_id: m.team_id,
  }));

  await supabase.from('challenge_progress').upsert(rows, { ignoreDuplicates: true });
}

function computeNewStreak(prevStreak: number, lastSessionAt: string | null): number {
  if (!lastSessionAt) return 1;
  const diffDays = Math.floor((Date.now() - new Date(lastSessionAt).getTime()) / 86400000);
  if (diffDays <= 1) return prevStreak + 1;
  return 1;
}

function toProfile(row: Record<string, unknown>): CommunityProfile {
  return {
    id: row.id as string,
    name: (row.name as string | null) ?? 'Runner',
    level: (row.level as number) ?? 1,
    currentStreak: (row.current_streak as number) ?? 0,
    totalSessions: (row.total_sessions as number) ?? 0,
    totalDistanceKm: Number(row.total_distance_km ?? 0),
    winPoints: (row.win_points as number) ?? 0,
  };
}

function placeholderProfile(id: string): CommunityProfile {
  return {
    id,
    name: 'Runner',
    level: 1,
    currentStreak: 0,
    totalSessions: 0,
    totalDistanceKm: 0,
    winPoints: 0,
  };
}
