import { supabase } from '../api/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CommunityProfile {
  id: string;
  name: string;
  level: number;
  currentStreak: number;
  totalSessions: number;
  totalDistanceKm: number;
  winPoints: number;
  // Only populated by getUserProfile (full detail page). List queries don't
  // fetch these columns to avoid breaking before the migration is applied.
  discoverable?: boolean;
  longestRunMinutes?: number;
  bestStreakDays?: number;
  totalDurationMinutes?: number;
  lastSessionDate?: string | null;
}

// ─── Discoverability (user-controlled privacy) ───────────────────────────────

export async function getDiscoverable(): Promise<boolean> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return true;

  const { data } = await supabase
    .from('profiles')
    .select('discoverable')
    .eq('id', session.user.id)
    .maybeSingle();

  return data?.discoverable ?? true;
}

export async function setDiscoverable(discoverable: boolean): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return;

  const { error } = await supabase
    .from('profiles')
    .update({ discoverable })
    .eq('id', session.user.id);

  if (error) console.warn('[community] setDiscoverable error:', error.message);
}

// ─── Profile sync ─────────────────────────────────────────────────────────────

export async function syncCommunityProfile(
  userId: string,
  progress: {
    currentLevel: number;
    currentStreakDays: number;
    totalSessionsCompleted: number;
    totalDistanceKm: number;
    longestRunMinutes?: number;
    bestStreakDays?: number;
    totalDurationMinutes?: number;
    lastSessionDate?: string | null;
  },
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      level: progress.currentLevel,
      current_streak: progress.currentStreakDays,
      total_sessions: progress.totalSessionsCompleted,
      total_distance_km: progress.totalDistanceKm,
      longest_run_minutes: progress.longestRunMinutes ?? 0,
      best_streak_days: progress.bestStreakDays ?? 0,
      total_duration_minutes: progress.totalDurationMinutes ?? 0,
      last_session_date: progress.lastSessionDate ?? null,
      is_visible: progress.currentLevel >= 2,
    })
    .eq('id', userId);

  if (error) console.warn('[community] syncCommunityProfile error:', error.message);
}

// ─── Follow / Bench March ─────────────────────────────────────────────────────

export async function followUser(targetUserId: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return;

  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: session.user.id, following_id: targetUserId });

  if (error && error.code !== '23505')
    // ignore duplicate inserts
    console.warn('[community] followUser error:', error.message);
}

export async function unfollowUser(targetUserId: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return;

  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', session.user.id)
    .eq('following_id', targetUserId);

  if (error) console.warn('[community] unfollowUser error:', error.message);
}

export async function isFollowing(targetUserId: string): Promise<boolean> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return false;

  const { data } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', session.user.id)
    .eq('following_id', targetUserId)
    .maybeSingle();

  return !!data;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getFollowing(): Promise<CommunityProfile[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return [];

  // Step 1: get IDs of users this person follows
  const { data: rows, error: followError } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', session.user.id);

  if (followError || !rows?.length) return [];

  const ids = rows.map((r) => r.following_id as string);

  // Step 2: fetch their profiles
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, name, level, current_streak, total_sessions, total_distance_km, win_points')
    .in('id', ids)
    .eq('is_visible', true);

  if (profileError) return [];
  return (profiles ?? []).map(toProfile);
}

export async function searchUsers(query: string): Promise<CommunityProfile[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return [];

  const trimmed = query.trim();
  if (!trimmed) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, level, current_streak, total_sessions, total_distance_km, win_points')
    .eq('is_visible', true)
    .neq('id', session.user.id)
    .ilike('name', `%${trimmed}%`)
    .order('level', { ascending: false })
    .limit(30);

  if (error) return [];
  return (data ?? []).map(toProfile);
}

export async function getSuggestedRunners(): Promise<CommunityProfile[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return [];

  // All visible runners (Level 2+), highest level first; streak/sessions tie-break.
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, level, current_streak, total_sessions, total_distance_km, win_points')
    .eq('is_visible', true)
    .neq('id', session.user.id)
    .order('level', { ascending: false })
    .order('current_streak', { ascending: false })
    .order('total_sessions', { ascending: false })
    .limit(60);

  if (error) return [];
  return (data ?? []).map(toProfile);
}

export async function getUserProfile(userId: string): Promise<CommunityProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, name, level, current_streak, total_sessions, total_distance_km, win_points, discoverable, longest_run_minutes, best_streak_days, total_duration_minutes, last_session_date',
    )
    .eq('id', userId)
    .eq('is_visible', true)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  return {
    ...toProfile(row),
    discoverable: (row.discoverable as boolean | null) ?? true,
    longestRunMinutes: (row.longest_run_minutes as number | null) ?? 0,
    bestStreakDays: (row.best_streak_days as number | null) ?? 0,
    totalDurationMinutes: (row.total_duration_minutes as number | null) ?? 0,
    lastSessionDate: (row.last_session_date as string | null) ?? null,
  };
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

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
