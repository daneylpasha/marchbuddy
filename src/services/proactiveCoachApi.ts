// ============================================================================
// proactiveCoachApi — pulls server-generated coach messages into the client.
//
// The chat itself is persisted client-side (Zustand persist on AsyncStorage),
// so to surface proactive messages we poll the server's `coach_message_schedule`
// table for sent rows newer than the last sync watermark, then merge them
// into chatStore via mergeServerMessages().
//
// Why polling instead of realtime subscriptions:
//   - Foreground-only is enough — we already get a push notification while
//     the app is backgrounded, so the user opens the app TO see the message.
//   - Avoids opening a websocket on every screen.
//   - Cheap: one indexed query per app foreground, capped at LIMIT 50.
// ============================================================================

import { supabase } from '../api/supabase';
import type { ChatMessage, ProactiveTrigger } from '../types/chat';

interface RawRow {
  id: string;
  trigger_type: ProactiveTrigger;
  message_content: string | null;
  sent_at: string | null;
}

export interface FetchResult {
  messages: ChatMessage[];
  latestSentAt: string | null;
}

/**
 * Fetch proactive coach messages whose `sent_at` is newer than `sinceISO`.
 * Pass `null` on first sync to pull the most-recent batch.
 */
export async function fetchProactiveCoachMessages(
  userId: string,
  sinceISO: string | null,
): Promise<FetchResult> {
  try {
    let query = supabase
      .from('coach_message_schedule')
      .select('id, trigger_type, message_content, sent_at')
      .eq('user_id', userId)
      .eq('status', 'sent')
      .not('message_content', 'is', null)
      .order('sent_at', { ascending: true })
      .limit(50);

    if (sinceISO) {
      query = query.gt('sent_at', sinceISO);
    } else {
      // First sync: only pull the last 7 days so we don't dump months of
      // history into the chat at once. Users opening the app fresh see the
      // recent ones; older ones stay archived server-side.
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      query = query.gt('sent_at', sevenDaysAgo);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('proactiveCoachApi: fetch error:', error.message);
      return { messages: [], latestSentAt: null };
    }

    const rows = (data ?? []) as RawRow[];
    if (rows.length === 0) {
      return { messages: [], latestSentAt: null };
    }

    const messages: ChatMessage[] = rows
      .filter((r) => !!r.message_content && !!r.sent_at)
      .map((r) => ({
        id: `proactive-${r.id}`,
        role: 'coach',
        type: 'text',
        content: r.message_content!,
        timestamp: r.sent_at!,
        proactiveTrigger: r.trigger_type,
        serverScheduleId: r.id,
      }));

    const latestSentAt =
      rows.reduce<string | null>((acc, r) => {
        if (!r.sent_at) return acc;
        return !acc || r.sent_at > acc ? r.sent_at : acc;
      }, null);

    return { messages, latestSentAt };
  } catch (e) {
    console.warn('proactiveCoachApi: unexpected error', e);
    return { messages: [], latestSentAt: null };
  }
}
