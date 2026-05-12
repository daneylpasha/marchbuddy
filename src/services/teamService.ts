import { supabase } from '../api/supabase';
import type { CommunityProfile } from './communityService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TeamMember {
  userId: string;
  profile: CommunityProfile;
  winPointsEarned: number;
  joinedAt: string;
  isCapt: boolean;
}

export interface Team {
  id: string;
  name: string;
  captainId: string;
  winPoints: number;
  members: TeamMember[];
}

export interface TeamSummary {
  id: string;
  name: string;
  captainId: string;
  winPoints: number;
  memberCount: number;
  captainLevel: number;
  isFavorited: boolean;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getMyTeam(): Promise<Team | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const { data: memberRow } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (!memberRow) return null;
  return getTeamById(memberRow.team_id as string);
}

export async function getTeamById(teamId: string): Promise<Team | null> {
  const { data: team, error: tErr } = await supabase
    .from('teams')
    .select('id, name, captain_id, win_points')
    .eq('id', teamId)
    .maybeSingle();

  if (tErr || !team) return null;

  const { data: memberRows } = await supabase
    .from('team_members')
    .select('user_id, win_points_earned, joined_at')
    .eq('team_id', teamId);

  const memberIds = (memberRows ?? []).map((r) => r.user_id as string);

  const { data: profiles } = memberIds.length
    ? await supabase
        .from('profiles')
        .select('id, name, level, current_streak, total_sessions, total_distance_km, win_points')
        .in('id', memberIds)
    : { data: [] };

  const profileMap = new Map((profiles ?? []).map((p) => [p.id as string, toProfile(p)]));

  const members: TeamMember[] = (memberRows ?? []).map((r) => ({
    userId: r.user_id as string,
    profile: profileMap.get(r.user_id as string) ?? placeholderProfile(r.user_id as string),
    winPointsEarned: (r.win_points_earned as number) ?? 0,
    joinedAt: r.joined_at as string,
    isCapt: r.user_id === team.captain_id,
  }));

  return {
    id: team.id as string,
    name: team.name as string,
    captainId: team.captain_id as string,
    winPoints: (team.win_points as number) ?? 0,
    members,
  };
}

export async function searchTeams(query: string, myTeamId?: string): Promise<TeamSummary[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return [];

  const trimmed = query.trim();

  let q = supabase.from('teams').select('id, name, captain_id, win_points');

  if (trimmed) q = q.ilike('name', `%${trimmed}%`);
  if (myTeamId) q = q.neq('id', myTeamId);

  const { data: teams, error } = await q.order('win_points', { ascending: false }).limit(30);

  if (error || !teams?.length) return [];

  // Get member counts
  const teamIds = teams.map((t) => t.id as string);
  const { data: memberRows } = await supabase
    .from('team_members')
    .select('team_id')
    .in('team_id', teamIds);

  const countMap = new Map<string, number>();
  (memberRows ?? []).forEach((r) => {
    const tid = r.team_id as string;
    countMap.set(tid, (countMap.get(tid) ?? 0) + 1);
  });

  // Get captain levels
  const captainIds = teams.map((t) => t.captain_id as string);
  const { data: captainProfiles } = await supabase
    .from('profiles')
    .select('id, level')
    .in('id', captainIds);

  const captainLevelMap = new Map(
    (captainProfiles ?? []).map((p) => [p.id as string, (p.level as number) ?? 1]),
  );

  // Get favorites
  const { data: favRows } = await supabase
    .from('favorite_teams')
    .select('favorite_team_id')
    .eq('captain_id', session.user.id)
    .in('favorite_team_id', teamIds);

  const favSet = new Set((favRows ?? []).map((r) => r.favorite_team_id as string));

  return teams.map((t) => ({
    id: t.id as string,
    name: t.name as string,
    captainId: t.captain_id as string,
    winPoints: (t.win_points as number) ?? 0,
    memberCount: countMap.get(t.id as string) ?? 0,
    captainLevel: captainLevelMap.get(t.captain_id as string) ?? 1,
    isFavorited: favSet.has(t.id as string),
  }));
}

export async function getFavoriteTeams(myTeamId?: string): Promise<TeamSummary[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return [];

  const { data: rows } = await supabase
    .from('favorite_teams')
    .select('favorite_team_id')
    .eq('captain_id', session.user.id);

  if (!rows?.length) return [];

  const ids = rows.map((r) => r.favorite_team_id as string);
  return searchTeams('', myTeamId ? undefined : undefined).then(() =>
    searchTeamsById(ids, session.user.id, myTeamId),
  );
}

async function searchTeamsById(
  ids: string[],
  _userId: string,
  myTeamId?: string,
): Promise<TeamSummary[]> {
  if (!ids.length) return [];

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, captain_id, win_points')
    .in('id', ids);

  if (!teams?.length) return [];

  const filteredTeams = myTeamId ? teams.filter((t) => t.id !== myTeamId) : teams;
  const teamIds = filteredTeams.map((t) => t.id as string);

  const [{ data: memberRows }, { data: captainProfiles }] = await Promise.all([
    supabase.from('team_members').select('team_id').in('team_id', teamIds),
    supabase
      .from('profiles')
      .select('id, level')
      .in(
        'id',
        filteredTeams.map((t) => t.captain_id as string),
      ),
  ]);

  const countMap = new Map<string, number>();
  (memberRows ?? []).forEach((r) => {
    const tid = r.team_id as string;
    countMap.set(tid, (countMap.get(tid) ?? 0) + 1);
  });

  const captainLevelMap = new Map(
    (captainProfiles ?? []).map((p) => [p.id as string, (p.level as number) ?? 1]),
  );

  return filteredTeams.map((t) => ({
    id: t.id as string,
    name: t.name as string,
    captainId: t.captain_id as string,
    winPoints: (t.win_points as number) ?? 0,
    memberCount: countMap.get(t.id as string) ?? 0,
    captainLevel: captainLevelMap.get(t.captain_id as string) ?? 1,
    isFavorited: true,
  }));
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function createTeam(name: string): Promise<Team | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const { data: team, error } = await supabase
    .from('teams')
    .insert({ name: name.trim(), captain_id: session.user.id })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') throw new Error('A team with that name already exists.');
    if (error.code === '23514') throw new Error('Team name must be at least 3 characters.');
    throw new Error(error.message);
  }

  // Add creator as first member
  await supabase.from('team_members').insert({ team_id: team.id, user_id: session.user.id });

  return getTeamById(team.id as string);
}

export async function inviteMember(teamId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('team_members')
    .insert({ team_id: teamId, user_id: userId });

  if (error) {
    if (error.code === '23505') throw new Error('This runner is already on your team.');
    throw new Error(error.message);
  }

  // Recalculate captain: highest level member becomes captain
  await recalculateCaptain(teamId);
}

export async function removeMember(teamId: string, userId: string): Promise<void> {
  await supabase.from('team_members').delete().eq('team_id', teamId).eq('user_id', userId);

  await recalculateCaptain(teamId);
}

export async function favoriteTeam(teamId: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return;

  await supabase
    .from('favorite_teams')
    .upsert({ captain_id: session.user.id, favorite_team_id: teamId });
}

export async function unfavoriteTeam(teamId: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return;

  await supabase
    .from('favorite_teams')
    .delete()
    .eq('captain_id', session.user.id)
    .eq('favorite_team_id', teamId);
}

// ─── Captain recalculation ────────────────────────────────────────────────────

async function recalculateCaptain(teamId: string): Promise<void> {
  const { data: members } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('team_id', teamId);

  if (!members?.length) return;

  const memberIds = members.map((m) => m.user_id as string);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, level, current_streak, total_sessions')
    .in('id', memberIds);

  if (!profiles?.length) return;

  // Sort: highest level first, tiebreak by streak then sessions
  const sorted = [...profiles].sort((a, b) => {
    if ((b.level as number) !== (a.level as number))
      return (b.level as number) - (a.level as number);
    if ((b.current_streak as number) !== (a.current_streak as number))
      return (b.current_streak as number) - (a.current_streak as number);
    return (b.total_sessions as number) - (a.total_sessions as number);
  });

  const newCaptainId = sorted[0].id as string;
  await supabase.from('teams').update({ captain_id: newCaptainId }).eq('id', teamId);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
