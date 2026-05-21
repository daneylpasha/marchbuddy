// ============================================================================
// schedule-coach-messages — runs every 15 minutes via pg_cron
//
// Scans all eligible (authenticated, non-guest, non-paused) users and queues
// proactive coach messages into `coach_message_schedule`. Sending happens in
// a separate function (send-coach-messages) on its own 5-min schedule.
//
// Idempotency is enforced by the (user_id, trigger_type, trigger_reference_id)
// unique constraint on the table — re-running is safe.
// ============================================================================

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── Types ────────────────────────────────────────────────────────────────

type CoachTriggerType =
  | 'session_morning'
  | 'post_session'
  | 'missed_session'
  | 'weekly_recap';

interface ProfileRow {
  id: string;
  timezone: string | null;
  comeback_completed_at: string | null;
  notification_prefs: Record<string, unknown> | null;
}

interface ScheduledSessionRow {
  id: string;
  user_id: string;
  scheduled_at: string;
  session_title: string;
}

interface SessionRow {
  id: string;
  user_id: string;
  completed_at: string;
  plan_title: string;
}

// ─── Constants ────────────────────────────────────────────────────────────

const POST_SESSION_DELAY_MS = 4 * 60 * 60 * 1000; // 4 hours
const MORNING_LEAD_MS = 2 * 60 * 60 * 1000; // 2 hours before scheduled
const MORNING_FALLBACK_HOUR_LOCAL = 8; // 8:00 AM if no session time
const MISSED_DAY_NEXT_HOUR_LOCAL = 10; // 10:00 AM next day
const WEEKLY_RECAP_HOUR_LOCAL = 19; // Sunday 7pm
const COMEBACK_PAUSE_MS = 48 * 60 * 60 * 1000;

// ─── Timezone helpers ─────────────────────────────────────────────────────

/**
 * Given an IANA timezone, return a timestamptz for "today at H:00 local time".
 * Falls back to UTC if the timezone string is invalid.
 */
function todayAtLocalHour(timezone: string, hourLocal: number, offsetDays = 0): Date {
  const tz = timezone || 'UTC';
  try {
    // 1. Find the current Y-M-D in the user's timezone.
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = fmt.formatToParts(new Date());
    const y = Number(parts.find((p) => p.type === 'year')!.value);
    const m = Number(parts.find((p) => p.type === 'month')!.value);
    const d = Number(parts.find((p) => p.type === 'day')!.value) + offsetDays;

    // 2. Build a Date interpreted at midnight-UTC for that calendar day,
    //    then shift by the timezone offset for that exact moment so the
    //    result is "hourLocal:00 in tz".
    const target = new Date(Date.UTC(y, m - 1, d, hourLocal, 0, 0));
    // Figure out tz's offset *for that moment* by formatting the target.
    const tzOffsetMinutes = getTzOffsetMinutes(target, tz);
    return new Date(target.getTime() - tzOffsetMinutes * 60_000);
  } catch {
    const fallback = new Date();
    fallback.setUTCHours(hourLocal, 0, 0, 0);
    fallback.setUTCDate(fallback.getUTCDate() + offsetDays);
    return fallback;
  }
}

function getTzOffsetMinutes(at: Date, tz: string): number {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = Object.fromEntries(
      dtf.formatToParts(at).map((p) => [p.type, p.value]),
    );
    const asUTC = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour) === 24 ? 0 : Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    return (asUTC - at.getTime()) / 60_000;
  } catch {
    return 0;
  }
}

function getLocalDayOfWeek(timezone: string): number {
  // 0 = Sunday … 6 = Saturday
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'UTC',
      weekday: 'short',
    });
    const wd = fmt.format(new Date());
    return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[
      wd as 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat'
    ];
  } catch {
    return new Date().getUTCDay();
  }
}

function isoWeekKey(date: Date, timezone: string): string {
  // ISO-style "YYYY-Www" using the user's local week. We just need a stable
  // string for the idempotency reference id of weekly_recap.
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
    // Cheap weekly bucket — Sunday-anchored. Good enough for idempotency.
    const local = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00Z`);
    const day = local.getUTCDay();
    local.setUTCDate(local.getUTCDate() - day);
    return `week-${local.toISOString().slice(0, 10)}`;
  } catch {
    return `week-${date.toISOString().slice(0, 10)}`;
  }
}

// ─── Pref helpers ─────────────────────────────────────────────────────────

function isCoachProactiveEnabled(prefs: Record<string, unknown> | null): boolean {
  if (!prefs) return true;
  const v = prefs.coach_proactive;
  if (v === undefined || v === null) return true; // default ON
  return v !== false;
}

function isUserInComebackPause(comebackAt: string | null): boolean {
  if (!comebackAt) return false;
  return Date.now() - new Date(comebackAt).getTime() < COMEBACK_PAUSE_MS;
}

// ─── Schedule writers ─────────────────────────────────────────────────────

interface PendingInsert {
  user_id: string;
  trigger_type: CoachTriggerType;
  trigger_reference_id: string;
  scheduled_for: string; // ISO
}

async function queueRow(
  supabase: SupabaseClient,
  row: PendingInsert,
): Promise<'inserted' | 'duplicate' | 'error'> {
  // Use upsert with ignoreDuplicates to make this a true no-op on repeat.
  const { error, data } = await supabase
    .from('coach_message_schedule')
    .upsert(row, {
      onConflict: 'user_id,trigger_type,trigger_reference_id',
      ignoreDuplicates: true,
    })
    .select('id');

  if (error) {
    console.error('queueRow error:', error.message, row);
    return 'error';
  }
  return data && data.length > 0 ? 'inserted' : 'duplicate';
}

// ─── Per-trigger scanners ─────────────────────────────────────────────────

async function scanSessionMorningForUser(
  supabase: SupabaseClient,
  profile: ProfileRow,
): Promise<number> {
  // Find sessions scheduled in the rest of TODAY (user local) that don't yet
  // have a session_morning trigger queued. For each, schedule it for
  // max(now+1min, scheduled_at - 2h, today 8am local).
  const tz = profile.timezone || 'UTC';
  const todayStartLocal = todayAtLocalHour(tz, 0, 0);
  const tomorrowStartLocal = todayAtLocalHour(tz, 0, 1);

  const { data: scheduled, error } = await supabase
    .from('scheduled_sessions')
    .select('id, user_id, scheduled_at, session_title')
    .eq('user_id', profile.id)
    .gte('scheduled_at', todayStartLocal.toISOString())
    .lt('scheduled_at', tomorrowStartLocal.toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(1); // multiple sessions same day → first one only (spec §7)

  if (error || !scheduled || scheduled.length === 0) return 0;

  const session = scheduled[0] as ScheduledSessionRow;
  const scheduledAt = new Date(session.scheduled_at);
  const triggerAt = new Date(scheduledAt.getTime() - MORNING_LEAD_MS);
  // If 2h-before is already in the past (session was scheduled late at night
  // for an early morning), fall back to today-8am-local.
  const fallback = todayAtLocalHour(tz, MORNING_FALLBACK_HOUR_LOCAL);
  const finalAt = triggerAt.getTime() < Date.now() ? fallback : triggerAt;

  // Sanity: don't schedule for after the session itself.
  if (finalAt >= scheduledAt) return 0;

  const result = await queueRow(supabase, {
    user_id: profile.id,
    trigger_type: 'session_morning',
    trigger_reference_id: session.id,
    scheduled_for: finalAt.toISOString(),
  });

  // Edge case (spec §7): if user completed the session before the morning
  // message was sent, the sender function will cancel pending rows. Nothing
  // to do here.

  return result === 'inserted' ? 1 : 0;
}

async function scanPostSessionForUser(
  supabase: SupabaseClient,
  profile: ProfileRow,
): Promise<number> {
  // Find sessions completed in the last 4h15m (we run every 15m so this
  // window guarantees we catch every completion exactly once).
  const since = new Date(Date.now() - (POST_SESSION_DELAY_MS + 15 * 60_000)).toISOString();
  const { data: completed, error } = await supabase
    .from('sessions')
    .select('id, user_id, completed_at, plan_title')
    .eq('user_id', profile.id)
    .gte('completed_at', since)
    .order('completed_at', { ascending: false });

  if (error || !completed) return 0;

  let inserted = 0;
  for (const s of completed as SessionRow[]) {
    const triggerAt = new Date(new Date(s.completed_at).getTime() + POST_SESSION_DELAY_MS);
    const result = await queueRow(supabase, {
      user_id: profile.id,
      trigger_type: 'post_session',
      trigger_reference_id: s.id,
      scheduled_for: triggerAt.toISOString(),
    });
    if (result === 'inserted') inserted++;
  }
  return inserted;
}

async function scanMissedSessionForUser(
  supabase: SupabaseClient,
  profile: ProfileRow,
): Promise<number> {
  // Find yesterday-local scheduled sessions that have no matching completion.
  const tz = profile.timezone || 'UTC';
  const yesterdayStart = todayAtLocalHour(tz, 0, -1);
  const todayStart = todayAtLocalHour(tz, 0, 0);

  const { data: yesterdaysSessions, error } = await supabase
    .from('scheduled_sessions')
    .select('id, user_id, scheduled_at, session_title')
    .eq('user_id', profile.id)
    .gte('scheduled_at', yesterdayStart.toISOString())
    .lt('scheduled_at', todayStart.toISOString());

  if (error || !yesterdaysSessions || yesterdaysSessions.length === 0) return 0;

  // For each, check if there's a completion that day.
  const { data: completions } = await supabase
    .from('sessions')
    .select('completed_at')
    .eq('user_id', profile.id)
    .gte('completed_at', yesterdayStart.toISOString())
    .lt('completed_at', todayStart.toISOString())
    .limit(1);

  // If they completed ANY session yesterday, we don't fire missed_session.
  // (Pragmatic call: the user clearly engaged; a "you missed" message would
  // be wrong and annoying.)
  if (completions && completions.length > 0) return 0;

  const triggerAt = todayAtLocalHour(tz, MISSED_DAY_NEXT_HOUR_LOCAL);
  // Reference the first missed session of the day for stable idempotency.
  const session = (yesterdaysSessions as ScheduledSessionRow[]).sort((a, b) =>
    a.scheduled_at.localeCompare(b.scheduled_at),
  )[0];

  const result = await queueRow(supabase, {
    user_id: profile.id,
    trigger_type: 'missed_session',
    trigger_reference_id: session.id,
    scheduled_for: triggerAt.toISOString(),
  });
  return result === 'inserted' ? 1 : 0;
}

async function scanWeeklyRecapForUser(
  supabase: SupabaseClient,
  profile: ProfileRow,
): Promise<number> {
  // Only fires on Sunday in the user's local time. Once per local week,
  // enforced by the unique constraint via the week key.
  const tz = profile.timezone || 'UTC';
  if (getLocalDayOfWeek(tz) !== 0) return 0;

  const triggerAt = todayAtLocalHour(tz, WEEKLY_RECAP_HOUR_LOCAL);
  const weekKey = isoWeekKey(new Date(), tz);

  const result = await queueRow(supabase, {
    user_id: profile.id,
    trigger_type: 'weekly_recap',
    trigger_reference_id: weekKey,
    scheduled_for: triggerAt.toISOString(),
  });
  return result === 'inserted' ? 1 : 0;
}

// ─── Cancellation: early-completion of today's session ────────────────────

async function cancelPreemptedMorningTriggers(supabase: SupabaseClient): Promise<number> {
  // If the user completed their session BEFORE the session_morning trigger
  // fired, cancel that pending row so they don't get a "today's the day"
  // message for a session they've already finished.
  //
  // We do this in bulk: any pending morning row whose trigger_reference_id
  // matches a session that has a corresponding completion in `sessions`
  // table for the same user.
  const { data, error } = await supabase.rpc('cancel_preempted_morning_rows');
  if (error) {
    // RPC may not exist on first migration roll; do nothing rather than blow up.
    if (!error.message.includes('does not exist')) {
      console.warn('cancel_preempted_morning_rows RPC error:', error.message);
    }
    return 0;
  }
  return (data as number) ?? 0;
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

    // Pull all real (auth.users-backed) profiles. Guest users have no row
    // here so they're automatically excluded (spec §7).
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id, timezone, comeback_completed_at, notification_prefs');
    if (pErr) throw pErr;
    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ scheduled: 0, reason: 'no_profiles' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let totals = {
      session_morning: 0,
      post_session: 0,
      missed_session: 0,
      weekly_recap: 0,
      skipped_pref: 0,
      skipped_comeback: 0,
    };

    for (const p of profiles as ProfileRow[]) {
      if (!isCoachProactiveEnabled(p.notification_prefs)) {
        totals.skipped_pref++;
        continue;
      }
      if (isUserInComebackPause(p.comeback_completed_at)) {
        totals.skipped_comeback++;
        continue;
      }

      // Each scan is independent — one failure shouldn't block the others.
      try { totals.session_morning += await scanSessionMorningForUser(supabase, p); } catch (e) { console.warn('morning err', p.id, e); }
      try { totals.post_session   += await scanPostSessionForUser(supabase, p);    } catch (e) { console.warn('post err',    p.id, e); }
      try { totals.missed_session += await scanMissedSessionForUser(supabase, p);  } catch (e) { console.warn('missed err',  p.id, e); }
      try { totals.weekly_recap   += await scanWeeklyRecapForUser(supabase, p);    } catch (e) { console.warn('weekly err',  p.id, e); }
    }

    const cancelled = await cancelPreemptedMorningTriggers(supabase);

    return new Response(
      JSON.stringify({ scheduled: totals, cancelled_preempted: cancelled }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('schedule-coach-messages error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
