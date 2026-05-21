// ============================================================================
// detect-personal-records — async PR detection for a single session.
//
// Called by the client AFTER process-session-feedback returns (so the
// summary screen never blocks on this). The client passes the freshly-
// saved session_id; this function:
//
//   1. Loads that session row + the user's prior history
//   2. Runs detection (shared module — same logic as bulk backfill)
//   3. Inserts any new PRs (idempotent via DB unique constraint)
//   4. Computes the best Before/After comparison window
//   5. Fires PostHog `pr_detected` for each new PR
//   6. Returns the PRs + comparison to the client (banner + comparison card)
// ============================================================================

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  detectPrs,
  bestComparison,
  type SessionRecord,
  type DetectedPr,
  type Comparison,
} from '../_shared/pr-detection.ts';

interface RequestBody {
  sessionId: string;
}

interface ResponseBody {
  prs: Array<DetectedPr & { id: string }>;
  comparison: Comparison | null;
}

// ─── PostHog server-side capture (best-effort) ────────────────────────────

async function fireAnalyticsServer(
  event: string,
  properties: Record<string, unknown>,
): Promise<void> {
  const phKey = Deno.env.get('POSTHOG_API_KEY');
  const phHost = Deno.env.get('POSTHOG_HOST') || 'https://app.posthog.com';
  if (!phKey) return;
  try {
    await fetch(`${phHost}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: phKey,
        event,
        distinct_id: properties.user_id ?? 'unknown',
        properties: { ...properties, source: 'edge-function' },
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (e) {
    console.warn('PostHog capture failed:', (e as Error).message);
  }
}

// ─── Main handler ────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No auth header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Validate auth + extract user id.
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid auth' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = userData.user.id;

    const { sessionId } = (await req.json()) as RequestBody;
    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'sessionId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Load the current session ────────────────────────────────────────
    const { data: currentSession, error: curErr } = await supabase
      .from('sessions')
      .select(
        'id, user_id, plan_level, plan_title, planned_segments, completed_segments, actual_duration_minutes, actual_distance_km, pace_per_km, ended_early, environment, treadmill_stats, route_data, started_at, completed_at',
      )
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();
    if (curErr || !currentSession) {
      return new Response(
        JSON.stringify({ error: 'Session not found', detail: curErr?.message }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // ── Load prior history (everything before this session) ─────────────
    const { data: historyRows } = await supabase
      .from('sessions')
      .select(
        'id, user_id, plan_level, plan_title, planned_segments, completed_segments, actual_duration_minutes, actual_distance_km, pace_per_km, ended_early, environment, treadmill_stats, route_data, started_at, completed_at',
      )
      .eq('user_id', userId)
      .lt('completed_at', currentSession.completed_at)
      .order('completed_at', { ascending: false });

    const history: SessionRecord[] = (historyRows ?? []) as SessionRecord[];

    // ── Find first session at current level (for comparison window 2) ──
    const firstAtLevel = history
      .slice()
      .reverse() // oldest first
      .find((h) => h.plan_level === currentSession.plan_level) ?? null;

    // ── Detect PRs ──────────────────────────────────────────────────────
    const detected = detectPrs(currentSession as SessionRecord, history);

    // ── Insert detected PRs (idempotent via unique constraint) ─────────
    const insertedPrs: Array<DetectedPr & { id: string }> = [];
    if (detected.length > 0) {
      const rows = detected.map((p) => ({
        user_id: userId,
        pr_type: p.pr_type,
        pr_subtype: p.pr_subtype,
        value: p.value,
        previous_value: p.previous_value,
        session_id: sessionId,
        achieved_at: currentSession.completed_at,
        confidence: p.confidence,
        metadata: p.metadata,
      }));
      const { data: insertedRows, error: insErr } = await supabase
        .from('personal_records')
        .upsert(rows, {
          onConflict: 'user_id,pr_type,pr_subtype,session_id',
          ignoreDuplicates: true,
        })
        .select('id, pr_type, pr_subtype');

      if (insErr) {
        console.error('insert PRs error:', insErr.message);
      } else {
        // Stitch back the metadata onto the inserted rows so the client
        // gets a single object per PR with everything it needs.
        for (const row of insertedRows ?? []) {
          const orig = detected.find(
            (p) =>
              p.pr_type === row.pr_type &&
              (p.pr_subtype ?? null) === (row.pr_subtype ?? null),
          );
          if (orig) {
            insertedPrs.push({ ...orig, id: row.id as string });
            void fireAnalyticsServer('pr_detected', {
              user_id: userId,
              session_id: sessionId,
              pr_type: orig.pr_type,
              pr_subtype: orig.pr_subtype,
              confidence: orig.confidence,
              value: orig.value,
              previous_value: orig.previous_value,
            });
          }
        }
      }
    }

    // ── Comparison (best of 4 windows) ──────────────────────────────────
    const comparison = bestComparison(
      currentSession as SessionRecord,
      history,
      firstAtLevel as SessionRecord | null,
    );

    if (comparison) {
      void fireAnalyticsServer('comparison_shown', {
        user_id: userId,
        session_id: sessionId,
        comparison_type: comparison.window,
        relative_improvement_pct: comparison.improvement_pct,
      });
    }

    const response: ResponseBody = { prs: insertedPrs, comparison };
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('detect-personal-records error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
