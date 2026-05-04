import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProgressRow {
  user_id: string;
  team_id: string;
  sessions_completed: number;
  total_minutes: number;
  current_streak: number;
}

interface ChallengeRow {
  id: string;
  team_a_id: string;
  team_b_id: string;
  starts_at: string;
  ends_at: string;
}

interface TeamRow {
  id: string;
  captain_id: string;
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

function computeWinner(
  progress: ProgressRow[],
  teamAId: string,
  teamBId: string,
  durationDays: number,
): string | null {
  const aRows = progress.filter((r) => r.team_id === teamAId);
  const bRows = progress.filter((r) => r.team_id === teamBId);

  const memberCountA = aRows.length || 1;
  const memberCountB = bRows.length || 1;
  const expected = durationDays;

  const aCompletion = aRows.reduce((s, r) => s + r.sessions_completed, 0) / (expected * memberCountA);
  const bCompletion = bRows.reduce((s, r) => s + r.sessions_completed, 0) / (expected * memberCountB);
  const aStreak = aRows.reduce((s, r) => s + r.current_streak, 0);
  const bStreak = bRows.reduce((s, r) => s + r.current_streak, 0);
  const aVolume = aRows.reduce((s, r) => s + Number(r.total_minutes), 0);
  const bVolume = bRows.reduce((s, r) => s + Number(r.total_minutes), 0);

  let aWins = 0;
  let bWins = 0;

  if (aCompletion > bCompletion) aWins++; else if (bCompletion > aCompletion) bWins++;
  if (aStreak > bStreak) aWins++; else if (bStreak > aStreak) bWins++;
  if (aVolume > bVolume) aWins++; else if (bVolume > aVolume) bWins++;

  if (aWins > bWins) return teamAId;
  if (bWins > aWins) return teamBId;
  return null; // draw
}

// ─── Expo push ────────────────────────────────────────────────────────────────

async function sendExpoPush(token: string, title: string, body: string): Promise<void> {
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: token, title, body, sound: 'default', data: { type: 'D', event: 'challenge_completed' } }),
    });
  } catch {
    // Best-effort — finalization still succeeds even if push fails
  }
}

function isQuiet(timezone: string, quietStart: number, quietEnd: number): boolean {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'UTC',
      hour: 'numeric',
      hour12: false,
    });
    const parts = fmt.formatToParts(new Date());
    const hourPart = parts.find((p) => p.type === 'hour');
    const hour = hourPart ? (parseInt(hourPart.value, 10) === 24 ? 0 : parseInt(hourPart.value, 10)) : new Date().getUTCHours();
    if (quietStart === quietEnd) return false;
    if (quietStart < quietEnd) return hour >= quietStart && hour < quietEnd;
    return hour >= quietStart || hour < quietEnd;
  } catch { return false; }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Find all active challenges that have passed their end time
    const { data: expired, error: expErr } = await supabase
      .from('challenges')
      .select('id, team_a_id, team_b_id, starts_at, ends_at')
      .eq('status', 'active')
      .lte('ends_at', new Date().toISOString());

    if (expErr) throw expErr;
    if (!expired?.length) {
      return new Response(
        JSON.stringify({ finalized: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let finalizedCount = 0;

    for (const challenge of expired as ChallengeRow[]) {
      try {
        // Load all progress rows for this challenge
        const { data: progress } = await supabase
          .from('challenge_progress')
          .select('user_id, team_id, sessions_completed, total_minutes, current_streak')
          .eq('challenge_id', challenge.id);

        const durationDays = Math.max(
          1,
          Math.round(
            (new Date(challenge.ends_at).getTime() - new Date(challenge.starts_at).getTime()) / 86400000,
          ),
        );

        const winnerTeamId = computeWinner(
          (progress ?? []) as ProgressRow[],
          challenge.team_a_id,
          challenge.team_b_id,
          durationDays,
        );

        // Aggregate final scores for storage
        const rows = (progress ?? []) as ProgressRow[];
        const aRows = rows.filter((r) => r.team_id === challenge.team_a_id);
        const bRows = rows.filter((r) => r.team_id === challenge.team_b_id);
        const mc = (r: ProgressRow[]) => r.length || 1;

        const aCompletion = aRows.reduce((s, r) => s + r.sessions_completed, 0) / (durationDays * mc(aRows));
        const bCompletion = bRows.reduce((s, r) => s + r.sessions_completed, 0) / (durationDays * mc(bRows));

        // Update challenge to completed with final scores
        await supabase
          .from('challenges')
          .update({
            status: 'completed',
            winner_team_id: winnerTeamId,
            team_a_completion_rate: aCompletion,
            team_b_completion_rate: bCompletion,
            team_a_streak_total: aRows.reduce((s, r) => s + r.current_streak, 0),
            team_b_streak_total: bRows.reduce((s, r) => s + r.current_streak, 0),
            team_a_volume_minutes: aRows.reduce((s, r) => s + Number(r.total_minutes), 0),
            team_b_volume_minutes: bRows.reduce((s, r) => s + Number(r.total_minutes), 0),
          })
          .eq('id', challenge.id);

        // Award win points to the winning team
        if (winnerTeamId) {
          const winnerMembers = rows.filter((r) => r.team_id === winnerTeamId);

          // Increment profiles.win_points for each winner
          for (const member of winnerMembers) {
            await supabase.rpc('increment_win_points', { p_user_id: member.user_id });
          }

          // Increment teams.win_points
          const { data: teamRow } = await supabase
            .from('teams')
            .select('win_points')
            .eq('id', winnerTeamId)
            .maybeSingle();

          await supabase
            .from('teams')
            .update({ win_points: ((teamRow?.win_points as number) ?? 0) + 1 })
            .eq('id', winnerTeamId);

          // Update win_points_earned on team_members for winners
          for (const member of winnerMembers) {
            const { data: tmRow } = await supabase
              .from('team_members')
              .select('win_points_earned')
              .eq('team_id', winnerTeamId)
              .eq('user_id', member.user_id)
              .maybeSingle();

            await supabase
              .from('team_members')
              .update({ win_points_earned: ((tmRow?.win_points_earned as number) ?? 0) + 1 })
              .eq('team_id', winnerTeamId)
              .eq('user_id', member.user_id);
          }
        }

        // Notify both team captains
        const { data: teams } = await supabase
          .from('teams')
          .select('id, captain_id')
          .in('id', [challenge.team_a_id, challenge.team_b_id]);

        for (const team of (teams ?? []) as TeamRow[]) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('expo_push_token, timezone, notification_prefs')
            .eq('id', team.captain_id)
            .maybeSingle();

          if (!profile?.expo_push_token) continue;

          const prefs = (profile.notification_prefs as Record<string, unknown>) ?? {};
          if (prefs['community_events'] === false) continue;

          const quietStart = (prefs['quiet_hours_start'] as number) ?? 22;
          const quietEnd = (prefs['quiet_hours_end'] as number) ?? 7;
          if (isQuiet((profile.timezone as string) ?? 'UTC', quietStart, quietEnd)) continue;

          const isWinner = winnerTeamId === team.id;
          const isDraw = !winnerTeamId;

          const title = isDraw ? 'Challenge ended — Draw!' : isWinner ? 'You won the challenge!' : 'Challenge ended';
          const body = isDraw
            ? 'It was a closely contested battle. Well fought!'
            : isWinner
            ? 'Your team won the 7-day challenge. +1 win point each!'
            : 'Your opponents took this one. Keep training and challenge again.';

          await sendExpoPush(profile.expo_push_token as string, title, body);

          await supabase.from('notification_log').insert({
            user_id: team.captain_id,
            type: 'D',
            message: body,
            source: 'push',
          });
        }

        finalizedCount++;
      } catch (challengeErr) {
        console.error(`finalize-challenge: failed for ${challenge.id}:`, challengeErr);
      }
    }

    return new Response(
      JSON.stringify({ finalized: finalizedCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('finalize-challenge error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
