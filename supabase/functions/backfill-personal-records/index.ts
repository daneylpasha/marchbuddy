// ============================================================================
// backfill-personal-records — one-time bulk backfill of historical PRs.
//
// Strategy (per PM decision: hybrid):
//   1. Run once after deploy. Processes 50 users per invocation.
//   2. Reads `coach_v2_feature_flags.pr_backfill_progress.last_processed_user`
//      and resumes from the next user (alphabetical by uuid).
//   3. For each user: replays their session history in chronological order
//      through `detectPrs`, inserting PRs as if they were detected live.
//      `achieved_at` is set to each session's original completed_at (so the
//      Progress tab timeline reads naturally).
//   4. Updates progress jsonb between batches; aborts gracefully if the
//      `pr_backfill_enabled` flag is flipped off.
//
// Trigger:
//   - Either call manually via curl with service-role auth, OR
//   - Schedule a one-shot cron that fires it every minute until the
//     progress jsonb shows `done: true`. Recommended manual mode for V1.
//
// Idempotency: the personal_records unique constraint
// (user_id, pr_type, pr_subtype, session_id) means re-running the backfill
// is a true no-op. Safe to invoke repeatedly.
// ============================================================================

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { detectPrs, type SessionRecord } from '../_shared/pr-detection.ts';

const BATCH_SIZE = 50;

interface BackfillProgress {
  last_processed_user?: string | null; // uuid; null = haven't started
  users_done: number;
  prs_inserted: number;
  started_at?: string;
  done: boolean;
}

async function loadProgress(supabase: SupabaseClient): Promise<{
  progress: BackfillProgress;
  enabled: boolean;
}> {
  const { data } = await supabase
    .from('coach_v2_feature_flags')
    .select('pr_backfill_enabled, pr_backfill_progress')
    .eq('id', 1)
    .single();
  return {
    progress: (data?.pr_backfill_progress as BackfillProgress) ?? {
      users_done: 0,
      prs_inserted: 0,
      done: false,
    },
    enabled: data?.pr_backfill_enabled !== false,
  };
}

async function saveProgress(
  supabase: SupabaseClient,
  progress: BackfillProgress,
): Promise<void> {
  await supabase
    .from('coach_v2_feature_flags')
    .update({
      pr_backfill_progress: progress,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);
}

async function backfillOneUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  // Pull all sessions chronologically.
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select(
      'id, user_id, plan_level, plan_title, planned_segments, completed_segments, actual_duration_minutes, actual_distance_km, pace_per_km, ended_early, environment, treadmill_stats, route_data, started_at, completed_at',
    )
    .eq('user_id', userId)
    .order('completed_at', { ascending: true });
  if (error || !sessions || sessions.length === 0) return 0;

  let inserted = 0;
  // Replay: for each session, history = all sessions before it.
  for (let i = 0; i < sessions.length; i++) {
    const current = sessions[i] as SessionRecord;
    const history = sessions.slice(0, i) as SessionRecord[];
    const detected = detectPrs(current, history);
    if (detected.length === 0) continue;

    const rows = detected.map((p) => ({
      user_id: userId,
      pr_type: p.pr_type,
      pr_subtype: p.pr_subtype,
      value: p.value,
      previous_value: p.previous_value,
      session_id: current.id,
      // Use the session's actual completion date — Progress tab timeline
      // reads correctly (recommended in spec §11).
      achieved_at: current.completed_at,
      confidence: p.confidence,
      metadata: { ...p.metadata, backfilled: true },
    }));
    const { error: insErr, count } = await supabase
      .from('personal_records')
      .upsert(rows, {
        onConflict: 'user_id,pr_type,pr_subtype,session_id',
        ignoreDuplicates: true,
        count: 'exact',
      });
    if (!insErr && count != null) inserted += count;
  }
  return inserted;
}

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    // ── SECURITY: service-role-only endpoint ────────────────────────────
    // This function processes EVERY user in the database via service-role
    // queries (RLS bypass). Even though Supabase verifies the JWT by
    // default, any signed-in user has a valid JWT — without this gate they
    // could trigger expensive global scans. Require the caller's
    // Authorization header to carry the project's service_role key.
    const authHeader = req.headers.get('authorization') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    // The header is "Bearer <key>". We compare the substring to dodge any
    // whitespace/casing drift. constant-time compare is overkill here since
    // the key is server-side; equality on a long random string is fine.
    if (!serviceRoleKey || !authHeader.includes(serviceRoleKey)) {
      return new Response(
        JSON.stringify({ error: 'service_role_required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { progress, enabled } = await loadProgress(supabase);
    if (!enabled) {
      return new Response(
        JSON.stringify({ ok: true, reason: 'backfill_disabled', progress }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (progress.done) {
      return new Response(
        JSON.stringify({ ok: true, reason: 'already_done', progress }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Pull the next BATCH_SIZE users (alphabetical by uuid for stable
    // resume cursoring). Skip users we've already processed.
    let q = supabase
      .from('profiles')
      .select('id')
      .order('id', { ascending: true })
      .limit(BATCH_SIZE);
    if (progress.last_processed_user) {
      q = q.gt('id', progress.last_processed_user);
    }
    const { data: users, error: uErr } = await q;
    if (uErr) throw uErr;

    if (!users || users.length === 0) {
      // No more users to process — mark done.
      await saveProgress(supabase, {
        ...progress,
        done: true,
        last_processed_user: progress.last_processed_user ?? null,
      });
      return new Response(
        JSON.stringify({ ok: true, reason: 'no_more_users', progress }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let batchInserted = 0;
    let lastUserId: string = progress.last_processed_user ?? '';
    for (const u of users) {
      try {
        batchInserted += await backfillOneUser(supabase, u.id as string);
      } catch (e) {
        console.warn(`backfill user ${u.id} failed:`, (e as Error).message);
      }
      lastUserId = u.id as string;
    }

    const nextProgress: BackfillProgress = {
      last_processed_user: lastUserId,
      users_done: progress.users_done + users.length,
      prs_inserted: progress.prs_inserted + batchInserted,
      started_at: progress.started_at ?? new Date().toISOString(),
      done: users.length < BATCH_SIZE, // less than full batch = we've finished
    };
    await saveProgress(supabase, nextProgress);

    return new Response(
      JSON.stringify({
        ok: true,
        processed_users: users.length,
        inserted: batchInserted,
        progress: nextProgress,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('backfill-personal-records error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
