/**
 * Records that the user actually *completed* a session. Feeds the
 * re-engagement activity signal used by the send-push-notification
 * Edge Function so we don't nag users who are actually showing up.
 *
 * Best-effort: failures are logged but never block the UI.
 */

import { supabase } from '../../api/supabase';

export interface LogCompletionArgs {
  sessionKey: string;
  sessionTitle?: string;
  completedAt?: Date;
}

export async function logSessionCompletion(args: LogCompletionArgs): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) return;

    await supabase.from('completed_sessions').insert({
      user_id: user.id,
      session_key: args.sessionKey,
      session_title: args.sessionTitle ?? null,
      completed_at: (args.completedAt ?? new Date()).toISOString(),
    });
  } catch (err) {
    console.warn('logSessionCompletion failed:', err);
  }
}
