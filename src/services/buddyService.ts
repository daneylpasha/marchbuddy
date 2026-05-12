import { supabase } from '../api/supabase';
import type { CommunityProfile } from './communityService';

function sendBuddyRequestPush(targetUserId: string, senderId: string): void {
  supabase.functions
    .invoke('send-social-push', {
      body: { event: 'buddy_request', targetUserId, senderId },
    })
    .catch(() => {});
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type BuddyStatus =
  | 'none'
  | 'pending_sent' // I sent a request, waiting on them
  | 'pending_received' // They sent a request, waiting on me
  | 'accepted'; // We're buddies

export interface BuddyRequest {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  // Profile of the other party (populated on fetch)
  profile?: CommunityProfile;
}

// How many levels apart is "similar enough" to buddy up
const LEVEL_RANGE = 2;

export function levelsCompatible(myLevel: number, theirLevel: number): boolean {
  return Math.abs(myLevel - theirLevel) <= LEVEL_RANGE;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getBuddyStatus(targetUserId: string): Promise<BuddyStatus> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return 'none';

  const me = session.user.id;

  // Check both directions (A→B and B→A are separate rows)
  const { data } = await supabase
    .from('buddy_requests')
    .select('id, requester_id, addressee_id, status')
    .or(
      `and(requester_id.eq.${me},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${me})`,
    )
    .in('status', ['pending', 'accepted'])
    .maybeSingle();

  if (!data) return 'none';
  if (data.status === 'accepted') return 'accepted';
  if (data.requester_id === me) return 'pending_sent';
  return 'pending_received';
}

export async function getBuddies(): Promise<CommunityProfile[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return [];

  const me = session.user.id;

  const { data: rows, error } = await supabase
    .from('buddy_requests')
    .select('requester_id, addressee_id')
    .or(`requester_id.eq.${me},addressee_id.eq.${me}`)
    .eq('status', 'accepted');

  if (error || !rows?.length) return [];

  const buddyIds = rows.map((r) =>
    r.requester_id === me ? r.addressee_id : r.requester_id,
  ) as string[];

  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, name, level, current_streak, total_sessions, total_distance_km, win_points')
    .in('id', buddyIds)
    .eq('is_visible', true);

  if (pErr) return [];
  return (profiles ?? []).map(toProfile);
}

export async function getPendingIncoming(): Promise<BuddyRequest[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return [];

  const { data: rows, error } = await supabase
    .from('buddy_requests')
    .select('id, requester_id, addressee_id, status, created_at')
    .eq('addressee_id', session.user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error || !rows?.length) return [];

  const requesterIds = rows.map((r) => r.requester_id as string);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, level, current_streak, total_sessions, total_distance_km, win_points')
    .in('id', requesterIds)
    .eq('is_visible', true);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, toProfile(p)]));

  return rows.map((r) => ({
    id: r.id as string,
    requesterId: r.requester_id as string,
    addresseeId: r.addressee_id as string,
    status: r.status as 'pending',
    createdAt: r.created_at as string,
    profile: profileMap.get(r.requester_id as string),
  }));
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function sendBuddyRequest(targetUserId: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return;

  const { error } = await supabase
    .from('buddy_requests')
    .insert({ requester_id: session.user.id, addressee_id: targetUserId });

  if (error && error.code !== '23505') {
    // ignore duplicate
    console.warn('[buddy] sendBuddyRequest error:', error.message);
    return;
  }

  // Notify the addressee (fire-and-forget)
  sendBuddyRequestPush(targetUserId, session.user.id);
}

export async function cancelBuddyRequest(targetUserId: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return;

  const { error } = await supabase
    .from('buddy_requests')
    .delete()
    .eq('requester_id', session.user.id)
    .eq('addressee_id', targetUserId)
    .eq('status', 'pending');

  if (error) console.warn('[buddy] cancelBuddyRequest error:', error.message);
}

export async function acceptBuddyRequest(requestId: string): Promise<void> {
  const { error } = await supabase
    .from('buddy_requests')
    .update({ status: 'accepted' })
    .eq('id', requestId);

  if (error) console.warn('[buddy] acceptBuddyRequest error:', error.message);
}

export async function declineBuddyRequest(requestId: string): Promise<void> {
  const { error } = await supabase
    .from('buddy_requests')
    .update({ status: 'declined' })
    .eq('id', requestId);

  if (error) console.warn('[buddy] declineBuddyRequest error:', error.message);
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
