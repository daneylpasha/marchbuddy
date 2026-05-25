// services/buddyConnectionService.ts
// Complete service for the Buddy Codes feature (new, standalone).
// Does NOT depend on the old buddyService.ts (hidden community flow).

import { supabase } from '../api/supabase';
import { SUPABASE_URL } from '../config/env';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BuddyConnectionStatus = 'none' | 'pending_sent' | 'pending_received' | 'active';

export interface BuddyProfile {
  id: string;
  name: string;
  level: number;
}

export interface BuddyConnectionState {
  status: BuddyConnectionStatus;
  connectionId?: string;
  buddy?: BuddyProfile;
  initiatedByMe?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

/**
 * Fire-and-forget invocation of send-social-push Edge Function.
 * Failures are swallowed intentionally — push is best-effort.
 */
function fireBuddyPush(event: string, targetUserId: string): void {
  const myId = supabase.auth.getUser().then(({ data }) => data?.user?.id);
  myId
    .then((senderId) => {
      if (!senderId) return;
      const url = `${SUPABASE_URL}/functions/v1/send-social-push`;
      // Use getSession for the anon key bearer token
      return supabase.auth.getSession().then(({ data: sessionData }) => {
        const token = sessionData?.session?.access_token;
        if (!token) return;
        return fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ event, targetUserId, senderId }),
        });
      });
    })
    .catch((err) => console.warn('[buddyConnectionService] fireBuddyPush failed:', err));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the current user's buddy code, or null if not authenticated.
 */
export async function getMyBuddyCode(): Promise<string | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('buddy_code')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.warn('[buddyConnectionService] getMyBuddyCode error:', error.message);
    return null;
  }

  return (data?.buddy_code as string | null) ?? null;
}

/**
 * Returns the current user's active or pending buddy connection state.
 */
export async function getMyBuddyConnection(): Promise<BuddyConnectionState> {
  const userId = await getCurrentUserId();
  if (!userId) return { status: 'none' };

  const { data, error } = await supabase
    .from('buddy_connections')
    .select('id, user_a_id, user_b_id, initiated_by, status')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .in('status', ['pending', 'active'])
    .maybeSingle();

  if (error) {
    console.warn('[buddyConnectionService] getMyBuddyConnection error:', error.message);
    return { status: 'none' };
  }

  if (!data) return { status: 'none' };

  const row = data as {
    id: string;
    user_a_id: string;
    user_b_id: string;
    initiated_by: string;
    status: string;
  };

  const buddyId = row.user_a_id === userId ? row.user_b_id : row.user_a_id;

  // Fetch buddy profile (visibility not required — buddies see each other)
  const { data: profileData } = await supabase
    .from('profiles')
    .select('id, name, level')
    .eq('id', buddyId)
    .maybeSingle();

  const buddy: BuddyProfile | undefined = profileData
    ? {
        id: profileData.id as string,
        name: (profileData.name as string | null) ?? 'Runner',
        level: (profileData.level as number) ?? 1,
      }
    : undefined;

  if (row.status === 'active') {
    return {
      status: 'active',
      connectionId: row.id,
      buddy,
    };
  }

  // status === 'pending'
  const initiatedByMe = row.initiated_by === userId;
  return {
    status: initiatedByMe ? 'pending_sent' : 'pending_received',
    connectionId: row.id,
    buddy,
    initiatedByMe,
  };
}

/**
 * Look up a user by their buddy code.
 * Returns null if not found or if the user has allow_buddy_connections = false.
 */
export async function lookupUserByCode(
  code: string,
): Promise<{ id: string; name: string } | null> {
  const normalized = code.trim().toUpperCase();
  if (normalized.length !== 6) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, allow_buddy_connections')
    .eq('buddy_code', normalized)
    .eq('allow_buddy_connections', true)
    .maybeSingle();

  if (error) {
    console.warn('[buddyConnectionService] lookupUserByCode error:', error.message);
    return null;
  }

  if (!data) return null;

  return {
    id: data.id as string,
    name: (data.name as string | null) ?? 'Runner',
  };
}

/**
 * Send a buddy request to another user.
 * Enforces canonical ordering (user_a_id < user_b_id).
 */
export async function sendBuddyRequest(
  targetUserId: string,
): Promise<{ success: boolean; error?: string }> {
  const myId = await getCurrentUserId();
  if (!myId) return { success: false, error: 'Not authenticated' };

  if (myId === targetUserId) {
    return { success: false, error: "You can't send a buddy request to yourself" };
  }

  // Guard: check if either user already has an active or pending connection
  const { data: existing } = await supabase
    .from('buddy_connections')
    .select('id, status')
    .or(`user_a_id.eq.${myId},user_b_id.eq.${myId}`)
    .in('status', ['pending', 'active'])
    .maybeSingle();

  if (existing) {
    return {
      success: false,
      error:
        existing.status === 'active'
          ? 'You already have an active buddy'
          : 'You already have a pending buddy request',
    };
  }

  // Check target user doesn't already have an active/pending connection
  const { data: targetExisting } = await supabase
    .from('buddy_connections')
    .select('id, status')
    .or(`user_a_id.eq.${targetUserId},user_b_id.eq.${targetUserId}`)
    .in('status', ['pending', 'active'])
    .maybeSingle();

  if (targetExisting) {
    return {
      success: false,
      error: 'This user already has a buddy connection',
    };
  }

  // Canonical ordering
  const sorted = [myId, targetUserId].sort();
  const user_a_id = sorted[0];
  const user_b_id = sorted[1];

  const { error: insertError } = await supabase.from('buddy_connections').insert({
    user_a_id,
    user_b_id,
    initiated_by: myId,
    status: 'pending',
  });

  if (insertError) {
    if (insertError.code === '23505') {
      return { success: false, error: 'Already connected or request pending' };
    }
    console.warn('[buddyConnectionService] sendBuddyRequest error:', insertError.message);
    return { success: false, error: insertError.message };
  }

  // Fire push notification (fire-and-forget)
  fireBuddyPush('buddy_request_received', targetUserId);

  return { success: true };
}

/**
 * Cancel a pending request that the current user initiated.
 */
export async function cancelRequest(connectionId: string): Promise<void> {
  const myId = await getCurrentUserId();
  if (!myId) return;

  const { error } = await supabase
    .from('buddy_connections')
    .delete()
    .eq('id', connectionId)
    .eq('initiated_by', myId)
    .eq('status', 'pending');

  if (error) console.warn('[buddyConnectionService] cancelRequest error:', error.message);
}

/**
 * Accept a pending buddy request. Sends a push back to the initiator.
 */
export async function acceptRequest(
  connectionId: string,
  initiatorId: string,
): Promise<void> {
  const { error } = await supabase
    .from('buddy_connections')
    .update({ status: 'active', accepted_at: new Date().toISOString() })
    .eq('id', connectionId);

  if (error) {
    console.warn('[buddyConnectionService] acceptRequest error:', error.message);
    return;
  }

  // Notify the initiator that the request was accepted (fire-and-forget)
  fireBuddyPush('buddy_request_accepted', initiatorId);
}

/**
 * Decline a pending buddy request.
 */
export async function declineRequest(connectionId: string): Promise<void> {
  const { error } = await supabase
    .from('buddy_connections')
    .update({ status: 'declined' })
    .eq('id', connectionId);

  if (error) console.warn('[buddyConnectionService] declineRequest error:', error.message);
}

/**
 * Remove an active buddy connection.
 */
export async function removeBuddy(connectionId: string): Promise<void> {
  const { error } = await supabase
    .from('buddy_connections')
    .update({ status: 'removed' })
    .eq('id', connectionId);

  if (error) console.warn('[buddyConnectionService] removeBuddy error:', error.message);
}
