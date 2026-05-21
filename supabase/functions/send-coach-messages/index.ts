// ============================================================================
// send-coach-messages — runs every 5 minutes via pg_cron
//
// Picks up `pending` and `skipped_quiet_hours_deferred` rows from
// `coach_message_schedule` whose scheduled_for has arrived, generates a
// message via Claude (with fallback pool), inserts it into the chat surface,
// fires a push notification, and updates the row.
//
// Quiet-hours handling:
//   - If the user is currently in quiet hours, the chat-side delivery still
//     happens (status='sent', so the client picks it up on next foreground)
//     BUT the push notification is suppressed. The spec calls this
//     "defer push until quiet hours end" — pragmatically the chat message
//     is the durable record; the push is a nudge. We don't re-fire a
//     deferred push later because by the time quiet hours end the chat
//     message is already waiting and a re-push would be a duplicate.
// ============================================================================

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { callClaude } from '../_shared/claude.ts';
import {
  COACH_PROACTIVE_SYSTEM_PROMPT,
  CoachTriggerType,
  CoachMessageContext,
  buildUserPrompt,
  pickFallback,
  pickPostSessionFallbackWithPr,
  sanitizeMessage,
  toPushBody,
} from '../_shared/coach-prompts.ts';

// ─── Types ────────────────────────────────────────────────────────────────

interface ScheduleRow {
  id: string;
  user_id: string;
  trigger_type: CoachTriggerType;
  trigger_reference_id: string;
  scheduled_for: string;
  status: string;
}

interface ProfileRow {
  id: string;
  name: string | null;
  timezone: string | null;
  expo_push_token: string | null;
  notification_prefs: Record<string, unknown> | null;
  comeback_completed_at: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────

const DEFAULT_QUIET_START = 22;
const DEFAULT_QUIET_END = 7;
const BATCH_SIZE = 50;
const COMEBACK_PAUSE_MS = 48 * 60 * 60 * 1000;

// ─── V2 Auto-PRs: format a personal_records row for the coach prompt ────

function formatPrForPrompt(
  prType: string,
  prSubtype: string | null,
  value: number,
  previousValue: number | null,
): NonNullable<CoachMessageContext['postSessionPr']> {
  const formatPace = (secPerKm: number): string => {
    const total = Math.round(secPerKm);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}/km`;
  };

  let displayLabel = 'personal best';
  let displayValue = '';
  switch (prType) {
    case 'fastest_pace':
      displayLabel = 'fastest overall pace';
      displayValue = formatPace(value);
      break;
    case 'fastest_1k_split':
      displayLabel = 'fastest 1K split';
      displayValue = formatPace(value);
      break;
    case 'longest_distance':
      displayLabel = 'longest distance';
      displayValue = `${(value / 1000).toFixed(2)} km`;
      break;
    case 'longest_duration': {
      displayLabel = 'longest session';
      const m = Math.floor(value / 60);
      displayValue = `${m} min`;
      break;
    }
    case 'first_milestone':
      switch (prSubtype) {
        case 'first_1k':
          displayLabel = 'first 1K';
          break;
        case 'first_3k':
          displayLabel = 'first 3K';
          break;
        case 'first_5k':
          displayLabel = 'first 5K';
          break;
        case 'first_30min_no_walk':
          displayLabel = 'first 30-minute nonstop session';
          break;
        default:
          displayLabel = 'first milestone';
      }
      displayValue = '';
      break;
  }

  let previousDisplay: string | null = null;
  if (previousValue !== null) {
    switch (prType) {
      case 'fastest_pace':
      case 'fastest_1k_split':
        previousDisplay = `Previous: ${formatPace(previousValue)}`;
        break;
      case 'longest_distance':
        previousDisplay = `Previous: ${(previousValue / 1000).toFixed(2)} km`;
        break;
      case 'longest_duration':
        previousDisplay = `Previous: ${Math.floor(previousValue / 60)} min`;
        break;
    }
  }

  return {
    type: prType as NonNullable<CoachMessageContext['postSessionPr']>['type'],
    subtype: prSubtype,
    displayLabel,
    displayValue,
    previousDisplay,
  };
}

// ─── Quiet hours (same logic as send-push-notification) ──────────────────

function getHourInTimezone(timezone: string): number {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    });
    const parts = fmt.formatToParts(new Date());
    const hourPart = parts.find((p) => p.type === 'hour');
    if (!hourPart) return new Date().getUTCHours();
    const hour = parseInt(hourPart.value, 10);
    return hour === 24 ? 0 : hour;
  } catch {
    return new Date().getUTCHours();
  }
}

function isQuietHoursForUser(
  timezone: string,
  quietStart: number,
  quietEnd: number,
): boolean {
  const hour = getHourInTimezone(timezone || 'UTC');
  if (quietStart === quietEnd) return false;
  if (quietStart < quietEnd) return hour >= quietStart && hour < quietEnd;
  return hour >= quietStart || hour < quietEnd;
}

// ─── Context gathering ───────────────────────────────────────────────────

async function gatherContext(
  supabase: SupabaseClient,
  profile: ProfileRow,
  trigger: CoachTriggerType,
  triggerReferenceId: string,
): Promise<CoachMessageContext> {
  const firstName = profile.name?.split(/\s+/)[0]?.trim() || null;

  // Recent 3 sessions (completed or skipped)
  const { data: recent } = await supabase
    .from('sessions')
    .select('id, completed_at, plan_title, ended_early, feedback_rating')
    .eq('user_id', profile.id)
    .order('completed_at', { ascending: false })
    .limit(3);

  const recentSessions = (recent ?? []).map((s: Record<string, unknown>) => ({
    date: String(s.completed_at).slice(0, 10),
    title: (s.plan_title as string) ?? 'session',
    completed: !s.ended_early,
    feedbackRating: (s.feedback_rating as string | null) ?? null,
  }));

  // Run progress — we use `user_run_progress` to pull level info if available.
  let currentLevel: number | null = null;
  let currentLevelName: string | null = null;
  let currentStreakDays = 0;
  let sessionsAtCurrentLevel: { completed: number; total: number } | null = null;
  let lastRestDayDate: string | null = null;

  try {
    const { data: progress } = await supabase
      .from('user_run_progress')
      .select('current_level, current_level_name, current_streak_days, sessions_at_level_completed, sessions_at_level_total, last_rest_day_date')
      .eq('user_id', profile.id)
      .maybeSingle();
    if (progress) {
      currentLevel = (progress.current_level as number | null) ?? null;
      currentLevelName = (progress.current_level_name as string | null) ?? null;
      currentStreakDays = (progress.current_streak_days as number | null) ?? 0;
      if (progress.sessions_at_level_completed != null && progress.sessions_at_level_total != null) {
        sessionsAtCurrentLevel = {
          completed: progress.sessions_at_level_completed as number,
          total: progress.sessions_at_level_total as number,
        };
      }
      lastRestDayDate = (progress.last_rest_day_date as string | null) ?? null;
    }
  } catch {
    // Best-effort — context is allowed to be sparse.
  }

  const ctx: CoachMessageContext = {
    userFirstName: firstName,
    currentLevel,
    currentLevelName,
    sessionsAtCurrentLevel,
    currentStreakDays,
    lastRestDayDate,
    recentSessions,
  };

  // session_morning: include today's planned session details
  if (trigger === 'session_morning') {
    const { data: planned } = await supabase
      .from('scheduled_sessions')
      .select('session_title, scheduled_at')
      .eq('id', triggerReferenceId)
      .maybeSingle();
    if (planned) {
      // Duration isn't stored on scheduled_sessions directly. Best-effort
      // lookup from the latest matching `sessions` row of the same title;
      // if we don't find one, pass null and let the prompt instruct Claude
      // to NOT invent a number. Previously we defaulted to 20 min which
      // could surface a wrong duration in the message text.
      const { data: lookup } = await supabase
        .from('sessions')
        .select('planned_duration_minutes')
        .eq('user_id', profile.id)
        .eq('plan_title', planned.session_title)
        .order('completed_at', { ascending: false })
        .limit(1);
      const rawDuration = lookup?.[0]?.planned_duration_minutes as number | undefined;
      const durationMinutes =
        typeof rawDuration === 'number' && rawDuration > 0 ? Math.round(rawDuration) : null;
      ctx.todaysPlannedSession = {
        title: planned.session_title as string,
        durationMinutes,
        difficulty: null,
      };
    }
  }

  // post_session: pull PR + comparison that were detected at session save.
  // triggerReferenceId for this trigger is the session_id, so we can fetch
  // any personal_records rows that point to it directly.
  if (trigger === 'post_session') {
    try {
      const { data: prRows } = await supabase
        .from('personal_records')
        .select('pr_type, pr_subtype, value, previous_value, confidence, metadata')
        .eq('user_id', profile.id)
        .eq('session_id', triggerReferenceId);

      if (prRows && prRows.length > 0) {
        // Pick the single most "impressive" PR using the same ranking as the
        // client banner: milestones > distance > duration > pace > 1k split.
        const order: Record<string, number> = {
          first_milestone: 0,
          longest_distance: 1,
          longest_duration: 2,
          fastest_pace: 3,
          fastest_1k_split: 4,
          highest_cadence: 5,
        };
        const sorted = [...prRows].sort(
          (a: Record<string, unknown>, b: Record<string, unknown>) =>
            (order[a.pr_type as string] ?? 99) - (order[b.pr_type as string] ?? 99),
        );
        const top = sorted[0] as Record<string, unknown>;
        ctx.postSessionPr = formatPrForPrompt(
          top.pr_type as string,
          top.pr_subtype as string | null,
          top.value as number,
          top.previous_value as number | null,
        );
      }
    } catch (e) {
      // Best-effort — fall back to PR-less message if the table query fails.
      console.warn('gatherContext PR fetch failed:', (e as Error).message);
    }
    // Comparison is not currently persisted across the schedule boundary;
    // we'd need to add a `comparison_snapshots` table to surface it in the
    // coach message. For V2, surfacing the PR is the priority; comparison
    // is V2.1 to extend the coach message richness.
  }

  // weekly_recap: aggregate this week's stats
  if (trigger === 'weekly_recap') {
    const tz = profile.timezone || 'UTC';
    const weekStart = (() => {
      // Sunday-anchored week, midnight local.
      const now = new Date();
      const dow = (() => {
        try {
          const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' });
          return ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[
            fmt.format(now)
          ];
        } catch {
          return now.getUTCDay();
        }
      })();
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - dow);
      d.setUTCHours(0, 0, 0, 0);
      return d;
    })();

    const { data: weekSessions } = await supabase
      .from('sessions')
      .select('actual_duration_minutes, actual_distance_km')
      .eq('user_id', profile.id)
      .gte('completed_at', weekStart.toISOString());

    if (weekSessions) {
      ctx.weekStats = {
        sessionsCompleted: weekSessions.length,
        totalDistanceKm: weekSessions.reduce(
          (acc: number, s: Record<string, unknown>) => acc + ((s.actual_distance_km as number) ?? 0),
          0,
        ),
        totalDurationMinutes: weekSessions.reduce(
          (acc: number, s: Record<string, unknown>) => acc + ((s.actual_duration_minutes as number) ?? 0),
          0,
        ),
      };
    }
  }

  return ctx;
}

// ─── Message generation ──────────────────────────────────────────────────

async function generateMessage(
  trigger: CoachTriggerType,
  ctx: CoachMessageContext,
): Promise<{ text: string; method: 'claude' | 'fallback' }> {
  try {
    const userPrompt = buildUserPrompt(trigger, ctx);
    const raw = await callClaude(
      COACH_PROACTIVE_SYSTEM_PROMPT,
      [{ role: 'user', content: userPrompt }],
      undefined,
      300,
    );
    const cleaned = sanitizeMessage(raw);
    if (!cleaned || cleaned.length < 10) {
      // Empty/too-short responses are treated as failures.
      throw new Error('Claude returned empty/too-short message');
    }
    return { text: cleaned, method: 'claude' };
  } catch (err) {
    console.warn('Claude generation failed, falling back:', (err as Error).message);
    // V2 Auto-PRs: if a PR was set in this session and Claude fell over,
    // route through the PR-aware fallback so we don't drop the
    // acknowledgment entirely.
    if (trigger === 'post_session' && ctx.postSessionPr) {
      const pr = ctx.postSessionPr;
      const isMilestone = pr.type === 'first_milestone';
      const milestoneText = isMilestone ? pr.displayLabel : null;
      return {
        text: pickPostSessionFallbackWithPr(
          ctx.userFirstName,
          pr.displayLabel,
          pr.displayValue,
          isMilestone,
          milestoneText,
        ),
        method: 'fallback',
      };
    }
    return { text: pickFallback(trigger, ctx.userFirstName), method: 'fallback' };
  }
}

// ─── Push delivery ───────────────────────────────────────────────────────

async function sendExpoPush(
  token: string,
  body: string,
  data: Record<string, unknown>,
): Promise<void> {
  const resp = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: token,
      title: 'Coach',
      body,
      sound: 'default',
      data,
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Expo push failed: ${resp.status} ${txt}`);
  }
}

// ─── Analytics (best-effort, doesn't block delivery) ─────────────────────

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
    console.warn('PostHog server capture failed:', (e as Error).message);
  }
}

// ─── Row processor ───────────────────────────────────────────────────────

async function processRow(
  supabase: SupabaseClient,
  row: ScheduleRow,
  profilesById: Map<string, ProfileRow>,
): Promise<void> {
  const profile = profilesById.get(row.user_id);
  if (!profile) {
    await markFailed(supabase, row.id, 'no_profile');
    return;
  }

  // Re-check comeback pause at send time (could have been triggered between
  // schedule + send).
  if (
    profile.comeback_completed_at &&
    Date.now() - new Date(profile.comeback_completed_at).getTime() < COMEBACK_PAUSE_MS
  ) {
    await markCancelled(supabase, row.id, 'comeback_pause_active');
    return;
  }

  // Re-check pref — user may have toggled off after scheduling.
  const prefs = profile.notification_prefs ?? {};
  const proactiveEnabled = prefs.coach_proactive !== false;
  if (!proactiveEnabled) {
    await markCancelled(supabase, row.id, 'pref_disabled');
    return;
  }

  // For session_morning: double-check the session wasn't already completed.
  if (row.trigger_type === 'session_morning') {
    const { data: maybeCompleted } = await supabase
      .from('sessions')
      .select('id')
      .eq('user_id', row.user_id)
      .eq('id', row.trigger_reference_id)
      .limit(1);
    if (maybeCompleted && maybeCompleted.length > 0) {
      await markCancelled(supabase, row.id, 'session_already_completed');
      return;
    }
  }

  // Gather context + generate
  const ctx = await gatherContext(supabase, profile, row.trigger_type, row.trigger_reference_id);
  const { text, method } = await generateMessage(row.trigger_type, ctx);

  // Persist the generated content as 'sent' so the client picks it up
  // on next foreground sync.
  const sentAt = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from('coach_message_schedule')
    .update({
      status: 'sent',
      sent_at: sentAt,
      message_content: text,
      generation_method: method,
    })
    .eq('id', row.id);

  if (updateErr) {
    console.error('Failed to mark row sent:', updateErr.message);
    await markFailed(supabase, row.id, `db_update: ${updateErr.message}`);
    return;
  }

  // Push notification — respect quiet hours + token presence.
  //
  // Design decision: `coach_proactive` is the SOLE gate for this feature
  // (checked above). We deliberately do NOT couple to `session_reminders`,
  // which controls a different category (upcoming-session local alerts).
  // Coupling them was a code-review finding — a user disabling pre-session
  // reminders should NOT silently lose proactive coach pushes.
  const quietStart = (prefs.quiet_hours_start as number) ?? DEFAULT_QUIET_START;
  const quietEnd = (prefs.quiet_hours_end as number) ?? DEFAULT_QUIET_END;
  const inQuietHours = isQuietHoursForUser(profile.timezone || 'UTC', quietStart, quietEnd);
  const pushAllowed = !!profile.expo_push_token && !inQuietHours;

  if (pushAllowed) {
    try {
      await sendExpoPush(profile.expo_push_token!, toPushBody(text), {
        type: 'proactive_coach',
        trigger: row.trigger_type,
        schedule_id: row.id,
        deeplink: 'marchbuddy://coach',
      });
    } catch (e) {
      console.warn('push failed for row', row.id, (e as Error).message);
      // Don't roll back the row — chat message is the durable record.
    }
  } else if (inQuietHours) {
    // Mark the row so analytics can split "delivered without push" from
    // "fully delivered". Doesn't change client behavior.
    await supabase
      .from('coach_message_schedule')
      .update({ status: 'sent', failure_reason: 'push_deferred_quiet_hours' })
      .eq('id', row.id);
  }

  await fireAnalyticsServer('coach_message_sent', {
    user_id: row.user_id,
    trigger_type: row.trigger_type,
    generation_method: method,
    push_sent: pushAllowed,
  });
}

async function markFailed(supabase: SupabaseClient, id: string, reason: string): Promise<void> {
  await supabase
    .from('coach_message_schedule')
    .update({ status: 'failed', failure_reason: reason })
    .eq('id', id);
  await fireAnalyticsServer('coach_message_failed', { schedule_id: id, reason });
}

async function markCancelled(supabase: SupabaseClient, id: string, reason: string): Promise<void> {
  await supabase
    .from('coach_message_schedule')
    .update({ status: 'cancelled', failure_reason: reason })
    .eq('id', id);
}

// ─── Main handler ────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Pull due rows. Limit to BATCH_SIZE per run to keep latency predictable —
    // any overflow gets picked up on the next 5-min tick.
    const { data: due, error: dueErr } = await supabase
      .from('coach_message_schedule')
      .select('id, user_id, trigger_type, trigger_reference_id, scheduled_for, status')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(BATCH_SIZE);

    if (dueErr) throw dueErr;
    if (!due || due.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Bulk-fetch all relevant profiles in one shot.
    const userIds = [...new Set(due.map((r) => r.user_id))];
    const { data: profiles, error: profErr } = await supabase
      .from('profiles')
      .select('id, name, timezone, expo_push_token, notification_prefs, comeback_completed_at')
      .in('id', userIds);
    if (profErr) throw profErr;

    const profilesById = new Map<string, ProfileRow>();
    for (const p of (profiles as ProfileRow[] | null) ?? []) {
      profilesById.set(p.id, p);
    }

    // Sequential processing to keep Claude rate-limit pressure low. If volume
    // grows we can batch with limited concurrency.
    let processed = 0;
    for (const row of due as ScheduleRow[]) {
      try {
        await processRow(supabase, row, profilesById);
        processed++;
      } catch (e) {
        console.error('processRow error:', row.id, (e as Error).message);
        await markFailed(supabase, row.id, `unhandled: ${(e as Error).message}`);
      }
    }

    return new Response(
      JSON.stringify({ processed, batch_size: due.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('send-coach-messages error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
