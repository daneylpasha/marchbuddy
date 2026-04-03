import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── Message pools ────────────────────────────────────────────────────────

const MISSED_MESSAGES = [
  "No worries, {{name}}. Life happens. Your session is still here when you're ready.",
  "Missed today's session? That's okay — tomorrow is a clean slate.",
  "Even a 5-minute walk counts. We're not keeping score here.",
  "Hey {{name}}, no stress. Rest is part of the process too.",
  "Skipped today? No big deal. Show up when you can, {{name}}.",
  "{{name}}, your session will be waiting. No judgment, no pressure.",
];

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

function isQuietHours(): boolean {
  const hour = new Date().getHours();
  return hour >= 22 || hour < 7;
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

    // Skip during quiet hours
    if (isQuietHours()) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'quiet_hours' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Build user query
    let query = supabase
      .from('profiles')
      .select('id, name, expo_push_token')
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

    for (const user of users) {
      // Rate limit: max 1 push per day per user
      const { data: recentLog } = await supabase
        .from('notification_log')
        .select('id')
        .eq('user_id', user.id)
        .gte('sent_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (recentLog && recentLog.length > 0) continue;

      const userName = user.name || 'there';
      const token = user.expo_push_token;

      // Check for missed scheduled sessions (Type B)
      const { data: missedSessions } = await supabase
        .from('scheduled_sessions')
        .select('id, session_title, scheduled_at')
        .eq('user_id', user.id)
        .eq('notified', false)
        .lt('scheduled_at', new Date().toISOString())
        .gte(
          'scheduled_at',
          new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        );

      if (missedSessions && missedSessions.length > 0) {
        const msg = applyName(pickRandom(MISSED_MESSAGES), userName);
        await sendExpoPush(token, 'Missed Session', msg, { type: 'B' });

        // Mark as notified
        await supabase
          .from('scheduled_sessions')
          .update({ notified: true })
          .in(
            'id',
            missedSessions.map((s: { id: string }) => s.id),
          );

        await supabase.from('notification_log').insert({
          user_id: user.id,
          type: 'B',
          message: msg,
        });

        sentCount++;
        continue;
      }

      // Check for inactivity (Type C)
      // Look at the most recent session completion
      const { data: lastSession } = await supabase
        .from('scheduled_sessions')
        .select('created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      // Calculate days since last activity
      const lastDate = lastSession?.[0]?.created_at
        ? new Date(lastSession[0].created_at)
        : null;

      if (!lastDate) continue;

      const daysSince = Math.floor(
        (Date.now() - lastDate.getTime()) / (24 * 60 * 60 * 1000),
      );

      if (daysSince < 2) continue;

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
      });

      sentCount++;
    }

    return new Response(
      JSON.stringify({ success: true, sent: sentCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('send-push-notification error:', err);
    return new Response(
      JSON.stringify({ error: err.message ?? 'Internal error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
