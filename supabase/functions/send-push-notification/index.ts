import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── Constants ────────────────────────────────────────────────────────────

// A re-engagement "campaign" is a single dormancy period, keyed by the
// user's last-activity date. We send at most MAX_PUSHES_PER_CAMPAIGN pushes
// total per campaign; once hit we go silent until the user becomes active
// again (which rolls the last-activity date forward → new campaign_id).
const REENGAGEMENT_CAMPAIGN_ID_PREFIX = 'reengagement_';
const MAX_PUSHES_PER_CAMPAIGN = 3;

// Default quiet hours (user local time) when the user has no prefs set.
const DEFAULT_QUIET_START = 22;
const DEFAULT_QUIET_END = 7;

// ─── Message pools ────────────────────────────────────────────────────────

const REENGAGEMENT_DAY2 = [
  "Hey {{name}}, just checking in. Your body misses moving.",
  "{{name}}, a quick check-in. Ready for a walk?",
];

const REENGAGEMENT_DAY3 = [
  "Two days off. That's totally valid. Ready to shake it off?",
  "Hey {{name}}, when you're ready, your next session is waiting.",
];

const REENGAGEMENT_DAY4_PLUS = [
  "The hardest part is starting. You've done it before. You can again.",
  "A 10-minute walk today could change your entire afternoon.",
  "{{name}}, your future self is waiting at the finish line.",
  "Progress isn't linear. But showing up always counts.",
  "Small steps, {{name}}. That's all it takes to get back.",
  "You don't need motivation. You just need to start.",
  "{{name}}, one session. That's it. Just one to break the streak.",
  "Remember why you started, {{name}}. That reason hasn't changed.",
  "Your running shoes miss you, {{name}}. Just saying.",
  "Three minutes of walking > zero minutes of anything. Let's go, {{name}}.",
];

function pickRandom(pool: string[]): string {
  return pool[Math.floor(Math.random() * pool.length)];
}

function applyName(template: string, name: string): string {
  return template.replace(/\{\{name\}\}/g, name);
}

// ─── Timezone-aware quiet hours ───────────────────────────────────────────

/**
 * Get the current hour (0–23) in the given IANA timezone.
 * Falls back to UTC if the timezone is invalid.
 */
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
    // Intl may return "24" for midnight in some locales/engines — normalize to 0
    const hour = parseInt(hourPart.value, 10);
    return hour === 24 ? 0 : hour;
  } catch {
    return new Date().getUTCHours();
  }
}

/**
 * Evaluate quiet hours for a specific user.
 * Supports wrap-around windows (e.g. 22 → 7).
 */
function isQuietHoursForUser(
  timezone: string,
  quietStart: number,
  quietEnd: number,
): boolean {
  const hour = getHourInTimezone(timezone || 'UTC');
  if (quietStart === quietEnd) return false; // window disabled
  if (quietStart < quietEnd) {
    return hour >= quietStart && hour < quietEnd;
  }
  // Wrap-around (e.g. 22 → 7 means 22:00–06:59)
  return hour >= quietStart || hour < quietEnd;
}

// ─── Expo Push API ────────────────────────────────────────────────────────

async function sendExpoPush(
  token: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
) {
  const resp = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: token,
      title,
      body,
      sound: 'default',
      data: data ?? {},
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Expo push failed: ${resp.status} ${text}`);
  }

  return resp.json();
}

// ─── Types ────────────────────────────────────────────────────────────────

interface NotificationPrefs {
  session_reminders?: boolean;
  reengagement?: boolean;
  quiet_hours_start?: number;
  quiet_hours_end?: number;
}

interface UserRow {
  id: string;
  name: string | null;
  expo_push_token: string;
  timezone: string | null;
  notification_prefs: NotificationPrefs | null;
}

// ─── Main handler ─────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Can be triggered by cron (no body) or with { userId }
    let targetUserId: string | null = null;
    try {
      const body = await req.json();
      targetUserId = body.userId ?? null;
    } catch {
      // cron trigger — process all users
    }

    // Build user query (now includes timezone + prefs)
    let query = supabase
      .from('profiles')
      .select('id, name, expo_push_token, timezone, notification_prefs')
      .not('expo_push_token', 'is', null);

    if (targetUserId) {
      query = query.eq('id', targetUserId);
    }

    const { data: users, error: usersError } = await query;
    if (usersError) throw usersError;
    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, reason: 'no_eligible_users' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let sentCount = 0;
    let skippedQuiet = 0;
    let skippedPrefs = 0;
    let skippedRateLimit = 0;
    let skippedCampaignCap = 0;

    for (const user of users as UserRow[]) {
      const userName = user.name || 'there';
      const token = user.expo_push_token;
      const prefs = user.notification_prefs ?? {};
      const timezone = user.timezone || 'UTC';

      // ── Per-user pref: re-engagement opt-out ─────────────────────────
      if (prefs.reengagement === false) {
        skippedPrefs++;
        continue;
      }

      // ── Per-user quiet hours ─────────────────────────────────────────
      const quietStart = prefs.quiet_hours_start ?? DEFAULT_QUIET_START;
      const quietEnd = prefs.quiet_hours_end ?? DEFAULT_QUIET_END;
      if (isQuietHoursForUser(timezone, quietStart, quietEnd)) {
        skippedQuiet++;
        continue;
      }

      // ── Rate limit: max 1 push per 24h per user ──────────────────────
      const { data: recentLog } = await supabase
        .from('notification_log')
        .select('id')
        .eq('user_id', user.id)
        .gte('sent_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1);
      if (recentLog && recentLog.length > 0) {
        skippedRateLimit++;
        continue;
      }

      // ── Re-engagement (Type C) ───────────────────────────────────────
      //
      // NOTE: Type B ("Starting Soon" for upcoming sessions) has been
      // removed. The local on-device Type A notification already fires
      // 30 min before the scheduled time, so server Type B was a pure
      // duplicate and a primary cause of notification fatigue.
      //
      // Activity signal (Phase 3): prefer real completions from
      // `completed_sessions`. Only fall back to `scheduled_sessions`
      // for legacy users who completed sessions before that table
      // was introduced.
      const { data: lastCompletion } = await supabase
        .from('completed_sessions')
        .select('completed_at')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(1);

      let lastDate: Date | null = lastCompletion?.[0]?.completed_at
        ? new Date(lastCompletion[0].completed_at)
        : null;

      if (!lastDate) {
        const { data: lastSession } = await supabase
          .from('scheduled_sessions')
          .select('created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);

        lastDate = lastSession?.[0]?.created_at
          ? new Date(lastSession[0].created_at)
          : null;
      }

      if (!lastDate) continue;

      const daysSince = Math.floor(
        (Date.now() - lastDate.getTime()) / (24 * 60 * 60 * 1000),
      );

      if (daysSince < 2) continue;

      // ── Campaign cap: max N pushes per dormancy period ───────────────
      //
      // campaign_id is keyed to the user's last-activity date, so it is
      // stable for the duration of this dormancy period. When the user
      // books a new session, lastDate moves forward → new campaign_id →
      // cap resets naturally. No time window needed.
      const campaignId =
        REENGAGEMENT_CAMPAIGN_ID_PREFIX +
        lastDate.toISOString().slice(0, 10); // YYYY-MM-DD of last activity

      const { count: campaignCount } = await supabase
        .from('notification_log')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('campaign_id', campaignId);

      if ((campaignCount ?? 0) >= MAX_PUSHES_PER_CAMPAIGN) {
        skippedCampaignCap++;
        continue;
      }

      let pool: string[];
      if (daysSince === 2) {
        pool = REENGAGEMENT_DAY2;
      } else if (daysSince === 3) {
        pool = REENGAGEMENT_DAY3;
      } else {
        pool = REENGAGEMENT_DAY4_PLUS;
      }

      const msg = applyName(pickRandom(pool), userName);
      await sendExpoPush(token, 'We miss you!', msg, { type: 'C' });

      await supabase.from('notification_log').insert({
        user_id: user.id,
        type: 'C',
        message: msg,
        campaign_id: campaignId,
        source: 'push',
      });

      sentCount++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        skipped: {
          quiet_hours: skippedQuiet,
          prefs: skippedPrefs,
          rate_limit: skippedRateLimit,
          campaign_cap: skippedCampaignCap,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('send-push-notification error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? 'Internal error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
