// ============================================================================
// prApi — client wrapper for Personal Records Edge Function + history queries.
//
// All calls are best-effort: if the detect Edge Function fails or the user
// is offline, the post-session summary screen falls back to its standard
// "no PR" rendering. PR detection is supplementary, never blocking.
// ============================================================================

import { supabase } from '../api/supabase';
import type {
  DetectPrResponse,
  PersonalRecord,
  PrType,
} from '../types/personalRecord';

/**
 * Fire-and-await PR detection for a freshly-saved session. Returns null on
 * any failure so callers can fall through to the standard summary UI.
 */
export async function detectPrsForSession(
  sessionId: string,
): Promise<DetectPrResponse | null> {
  try {
    const { data, error } = await supabase.functions.invoke(
      'detect-personal-records',
      { body: { sessionId } },
    );
    if (error) {
      console.warn('detect-personal-records error:', error.message);
      return null;
    }
    return data as DetectPrResponse;
  } catch (e) {
    console.warn('detectPrsForSession unexpected error:', e);
    return null;
  }
}

/**
 * Fetch all PRs for the signed-in user, newest first. Used by the
 * Progress tab "Your PRs" section.
 */
export async function fetchUserPrs(userId: string): Promise<PersonalRecord[]> {
  try {
    const { data, error } = await supabase
      .from('personal_records')
      .select('*')
      .eq('user_id', userId)
      .order('achieved_at', { ascending: false });
    if (error) {
      console.warn('fetchUserPrs error:', error.message);
      return [];
    }
    return (data ?? []) as PersonalRecord[];
  } catch (e) {
    console.warn('fetchUserPrs unexpected error:', e);
    return [];
  }
}

/**
 * Fetch the user's progression history for a specific PR type — used to
 * render the mini-chart on the Progress tab showing how a PR was beaten
 * over time. Ordered ascending so the chart reads left-to-right.
 */
export async function fetchPrProgressionByType(
  userId: string,
  prType: PrType,
): Promise<PersonalRecord[]> {
  try {
    const { data, error } = await supabase
      .from('personal_records')
      .select('*')
      .eq('user_id', userId)
      .eq('pr_type', prType)
      .order('achieved_at', { ascending: true });
    if (error) {
      console.warn('fetchPrProgressionByType error:', error.message);
      return [];
    }
    return (data ?? []) as PersonalRecord[];
  } catch (e) {
    console.warn('fetchPrProgressionByType unexpected error:', e);
    return [];
  }
}
