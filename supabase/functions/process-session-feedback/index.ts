import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { callClaude } from '../_shared/claude.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface SessionData {
  planId: string;
  planLevel: number;
  planVariant: string;
  planTitle: string;
  plannedDurationMinutes: number;
  plannedSegments: unknown[];
  actualDurationMinutes: number;
  actualDistanceKm: number;
  completedSegments: number;
  endedEarly: boolean;
  pacePerKm: number | null;
  routeData: unknown[];
  feedbackRating: string;
  feedbackNotes: string | null;
  startedAt: string;
  completedAt: string;
}

interface OnboardingData {
  userName: string;
  triggerStatement?: string;
  anchorPerson?: string;
  primaryFear?: string;
  successVision?: string;
}

interface RequestBody {
  sessionData: SessionData;
  onboardingData: OnboardingData;
}

interface ProgressContext {
  totalSessions: number;
  currentStreak: number;
  leveledUp: boolean;
  newLevel: number;
  milestoneReached: string | null;
}

const SYSTEM_PROMPT = `You are an AI running coach providing post-session feedback. Your user just finished a walk/run workout.

Tone:
- Encouraging but genuine — not over-the-top
- Specific to what they actually did
- Brief — 3-4 sentences maximum
- Forward-looking — mention next session or continued progress

Adapt to their feedback rating:
- "too_easy": Acknowledge they crushed it, note you'll increase intensity next time
- "just_right": Affirm they hit the sweet spot, they're progressing well
- "challenging": Validate the effort — hard sessions build the most strength
- "too_hard": Empathize, every session counts, you'll adjust

If they ended early: Acknowledge without judgment. Partial completion still counts.

Occasionally (not every time) reference their deeper motivation from onboarding.

Never: be preachy, use generic "Great job!" without specifics, use excessive exclamation marks.`;

const buildCoachPrompt = (
  session: SessionData,
  onboarding: OnboardingData,
  progress: ProgressContext,
): string =>
  `Generate post-session feedback for ${onboarding.userName}.

Session completed:
- Plan: ${session.planTitle} (Level ${session.planLevel})
- Planned: ${session.plannedDurationMinutes} min
- Actual: ${session.actualDurationMinutes} min
- Distance: ${session.actualDistanceKm.toFixed(2)} km
- Ended early: ${session.endedEarly ? 'Yes' : 'No'}
- Their rating: ${session.feedbackRating}
${session.feedbackNotes ? `- Their notes: "${session.feedbackNotes}"` : ''}

Progress:
- Total sessions: ${progress.totalSessions}
- Current streak: ${progress.currentStreak} days
- Level: ${session.planLevel} of 16
${progress.leveledUp ? `- Just leveled up to Level ${progress.newLevel}!` : ''}

Onboarding context (use sparingly):
- Why they started: "${onboarding.triggerStatement || 'not provided'}"
- Who they do this for: "${onboarding.anchorPerson || 'not provided'}"

Write 3-4 sentences of coach feedback.`;

const MILESTONE_THRESHOLDS: Record<number, string> = {
  1: 'first_session',
  10: '10_sessions',
  25: '25_sessions',
  50: '50_sessions',
};

const DISTANCE_MILESTONES: Record<number, string> = {
  5: '5km_total',
  25: '25km_total',
  50: '50km_total',
};

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No auth header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid auth' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { sessionData, onboardingData }: RequestBody = await req.json();

    // ── 1. Save session ─────────────────────────────────────────────────────
    const { data: savedSession, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        user_id: user.id,
        plan_id: sessionData.planId,
        plan_level: sessionData.planLevel,
        plan_variant: sessionData.planVariant,
        plan_title: sessionData.planTitle,
        planned_duration_minutes: sessionData.plannedDurationMinutes,
        planned_segments: sessionData.plannedSegments,
        actual_duration_minutes: sessionData.actualDurationMinutes,
        actual_distance_km: sessionData.actualDistanceKm,
        completed_segments: sessionData.completedSegments,
        ended_early: sessionData.endedEarly,
        pace_per_km: sessionData.pacePerKm,
        route_data: sessionData.routeData,
        feedback_rating: sessionData.feedbackRating,
        feedback_notes: sessionData.feedbackNotes,
        started_at: sessionData.startedAt,
        completed_at: sessionData.completedAt,
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Error saving session:', sessionError);
      throw new Error('Failed to save session');
    }

    // ── 2. Load current progress ─────────────────────────────────────────────
    const { data: currentProgress } = await supabase
      .from('user_run_progress')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    // ── 3. Compute new progress ──────────────────────────────────────────────
    const today = new Date().toISOString().split('T')[0];

    let newStreak = 1;
    if (currentProgress?.last_session_date) {
      const lastDate = new Date(currentProgress.last_session_date);
      const todayDate = new Date(today);
      const diffDays = Math.floor(
        (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (diffDays === 0) {
        newStreak = currentProgress.current_streak_days;
      } else if (diffDays === 1) {
        newStreak = currentProgress.current_streak_days + 1;
      }
      // > 1 day gap → streak resets to 1
    }

    const prevTotalSessions = currentProgress?.total_sessions_completed ?? 0;
    const newTotalSessions = prevTotalSessions + 1;
    const prevSessionsAtLevel = currentProgress?.sessions_at_current_level ?? 0;
    const newSessionsAtLevel = prevSessionsAtLevel + 1;
    const newTotalDistanceKm =
      (currentProgress?.total_distance_km ?? 0) + sessionData.actualDistanceKm;
    const newTotalDuration =
      (currentProgress?.total_duration_minutes ?? 0) + sessionData.actualDurationMinutes;

    const longestRunThisSession = sessionData.plannedSegments
      .filter((s: unknown) => (s as { type: string }).type === 'run')
      .reduce(
        (max: number, s: unknown) =>
          Math.max(max, (s as { durationSeconds: number }).durationSeconds / 60),
        0,
      );
    const newLongestRun = Math.max(
      currentProgress?.longest_run_minutes ?? 0,
      longestRunThisSession,
    );

    // Level-up: 3 sessions at this level and not "too_hard"
    const currentLevel = currentProgress?.current_level ?? 1;
    let leveledUp = false;
    let newLevel = currentLevel;

    if (
      newSessionsAtLevel >= 3 &&
      sessionData.feedbackRating !== 'too_hard' &&
      currentLevel < 16
    ) {
      leveledUp = true;
      newLevel = currentLevel + 1;
    }

    // ── 4. Detect milestone ──────────────────────────────────────────────────
    let milestoneReached: string | null = null;

    if (MILESTONE_THRESHOLDS[newTotalSessions]) {
      milestoneReached = MILESTONE_THRESHOLDS[newTotalSessions];
    } else if (leveledUp) {
      milestoneReached = `level_${newLevel}`;
    } else if (newStreak === 7) {
      milestoneReached = 'week_streak';
    } else if (newStreak === 14) {
      milestoneReached = 'two_week_streak';
    } else if (newStreak === 30) {
      milestoneReached = 'month_streak';
    } else {
      const prevDistKm = currentProgress?.total_distance_km ?? 0;
      for (const [threshold, label] of Object.entries(DISTANCE_MILESTONES)) {
        const t = Number(threshold);
        if (newTotalDistanceKm >= t && prevDistKm < t) {
          milestoneReached = label;
          break;
        }
      }
    }

    // ── 5. Upsert progress ───────────────────────────────────────────────────
    await supabase.from('user_run_progress').upsert(
      {
        user_id: user.id,
        current_level: newLevel,
        sessions_at_current_level: leveledUp ? 0 : newSessionsAtLevel,
        total_sessions_completed: newTotalSessions,
        total_distance_km: newTotalDistanceKm,
        total_duration_minutes: newTotalDuration,
        longest_run_minutes: newLongestRun,
        current_streak_days: newStreak,
        best_streak_days: Math.max(currentProgress?.best_streak_days ?? 0, newStreak),
        last_session_date: today,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    // ── 6. Generate AI coach feedback ────────────────────────────────────────
    const progressContext: ProgressContext = {
      totalSessions: newTotalSessions,
      currentStreak: newStreak,
      leveledUp,
      newLevel,
      milestoneReached,
    };

    let coachFeedback = `Great work completing your session, ${onboardingData.userName}.`;
    try {
      coachFeedback = await callClaude(
        SYSTEM_PROMPT,
        [{ role: 'user', content: buildCoachPrompt(sessionData, onboardingData, progressContext) }],
        undefined,
        200,
      );
    } catch (err) {
      console.error('Claude error:', err);
    }

    // ── 7. Store coach feedback on session row ───────────────────────────────
    await supabase
      .from('sessions')
      .update({ coach_feedback: coachFeedback })
      .eq('id', savedSession.id);

    return new Response(
      JSON.stringify({
        sessionId: savedSession.id,
        coachFeedback,
        progressUpdate: {
          newLevel,
          leveledUp,
          totalSessions: newTotalSessions,
          currentStreak: newStreak,
          milestoneReached,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('process-session-feedback error:', errMsg);

    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
