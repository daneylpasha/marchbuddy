import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── Types ────────────────────────────────────────────────────────────────────

type SocialEvent =
  | 'challenge_invite'
  | 'challenge_accepted'
  | 'challenge_completed'
  | 'buddy_request'
  | 'buddy_request_received'
  | 'buddy_request_accepted';

interface RequestBody {
  event: SocialEvent;
  targetUserId: string;
  senderId: string;
  meta?: {
    senderTeamName?: string;
    winnerTeamId?: string;
    myTeamId?: string;
  };
}

interface UserRow {
  id: string;
  name: string | null;
  expo_push_token: string | null;
  timezone: string | null;
  notification_prefs: Record<string, unknown> | null;
}

// ─── Quiet hours ──────────────────────────────────────────────────────────────

const DEFAULT_QUIET_START = 22;
const DEFAULT_QUIET_END = 7;

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

function isQuiet(timezone: string, quietStart: number, quietEnd: number): boolean {
  const hour = getHourInTimezone(timezone || 'UTC');
  if (quietStart === quietEnd) return false;
  if (quietStart < quietEnd) return hour >= quietStart && hour < quietEnd;
  return hour >= quietStart || hour < quietEnd;
}

// ─── Expo push ────────────────────────────────────────────────────────────────

async function sendExpoPush(
  token: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  const resp = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to: token, title, body, sound: 'default', data: data ?? {} }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Expo push failed: ${resp.status} ${text}`);
  }
}

// ─── Message builders ─────────────────────────────────────────────────────────

function buildMessage(
  event: SocialEvent,
  senderName: string,
  meta: RequestBody['meta'],
): { title: string; body: string } {
  switch (event) {
    case 'challenge_invite':
      return {
        title: 'Challenge Incoming!',
        body: meta?.senderTeamName
          ? `${meta.senderTeamName} has challenged your team. Accept within 24 hours.`
          : `${senderName} has challenged your team to a 7-day outdoor battle.`,
      };
    case 'challenge_accepted':
      return {
        title: 'Challenge Accepted!',
        body: meta?.senderTeamName
          ? `${meta.senderTeamName} accepted your challenge. The battle begins now.`
          : `Your challenge was accepted. The 7-day battle begins now.`,
      };
    case 'challenge_completed':
      return {
        title: 'Challenge Complete',
        body: 'Your 7-day challenge has ended. Check the results.',
      };
    case 'buddy_request':
      return {
        title: 'Buddy Request',
        body: `${senderName} wants to be your MarchBuddy.`,
      };
    case 'buddy_request_received':
      return {
        title: 'Buddy Request',
        body: 'Someone wants to be your running buddy. Open the app to see who.',
      };
    case 'buddy_request_accepted':
      return {
        title: 'Buddy Connected!',
        body: `${senderName} is now your buddy! Time to keep each other accountable.`,
      };
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const body: RequestBody = await req.json();
    const { event, targetUserId, senderId, meta } = body;

    if (!event || !targetUserId || !senderId) {
      return new Response(
        JSON.stringify({ error: 'event, targetUserId, and senderId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Fetch target user + sender name in parallel
    const [targetRes, senderRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, name, expo_push_token, timezone, notification_prefs')
        .eq('id', targetUserId)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('name')
        .eq('id', senderId)
        .maybeSingle(),
    ]);

    const target = targetRes.data as UserRow | null;
    const senderName = (senderRes.data?.name as string | null) ?? 'Someone';

    if (!target?.expo_push_token) {
      return new Response(
        JSON.stringify({ skipped: 'no_token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const prefs = target.notification_prefs ?? {};

    // Check buddy_notifications pref for buddy events (default true — opt-out)
    if (event === 'buddy_request_received' || event === 'buddy_request_accepted') {
      if (prefs['buddy_notifications'] === false) {
        return new Response(
          JSON.stringify({ skipped: 'pref_off' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    } else {
      // Check community_events pref for non-buddy social events
      if (prefs['community_events'] === false) {
        return new Response(
          JSON.stringify({ skipped: 'pref_off' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // Quiet hours
    const quietStart = (prefs['quiet_hours_start'] as number) ?? DEFAULT_QUIET_START;
    const quietEnd = (prefs['quiet_hours_end'] as number) ?? DEFAULT_QUIET_END;
    if (isQuiet(target.timezone ?? 'UTC', quietStart, quietEnd)) {
      return new Response(
        JSON.stringify({ skipped: 'quiet_hours' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { title, body: msgBody } = buildMessage(event, senderName, meta);

    await sendExpoPush(target.expo_push_token, title, msgBody, {
      type: 'D',
      event: event,
      challengeId: meta?.myTeamId,
    });

    // Log so the 24h rate limit for re-engagement doesn't apply to social
    // pushes (different type), but we still have an audit trail.
    await supabase.from('notification_log').insert({
      user_id: targetUserId,
      type: 'D',
      message: msgBody,
      source: 'push',
    });

    return new Response(
      JSON.stringify({ sent: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('send-social-push error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
