import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { callClaude } from '../_shared/claude.ts';

type EffortLevel = 'easy' | 'as_planned' | 'hard' | 'incomplete';

interface SessionSignal {
  effortLevel: EffortLevel;
  feedbackRating: string | null;
}

interface RequestBody {
  userId: string;
  currentLevel: number;
  sessionsAtCurrentLevel: number;
  totalSessionsCompleted: number;
  lastSessionDate: string | null;
  currentStreakDays: number;
  sessionsThisWeek: number;
  recentSessionSignals?: SessionSignal[];
  onboardingData: {
    userName: string;
    triggerStatement?: string;
    anchorPerson?: string;
    primaryFear?: string;
    successVision?: string;
  };
}

interface ResponseBody {
  coachMessage: string;
  recommendedVariant: 'recommended' | 'quick' | 'challenge' | 'push';
  adjustmentReason?: string;
}

const SYSTEM_PROMPT = `You are an AI running coach for MarchBuddy, a couch-to-5K app. Generate a brief, personalized greeting message for the user's daily session screen.

Your tone:
- Warm and encouraging, never cheesy
- Brief — 2-3 sentences maximum
- Reference their specific situation (streak, days off, progress)
- Occasionally (not always) reference their deeper motivation from onboarding
- Forward-looking — orient them toward today's session

Never:
- Use generic phrases like "Great job!" without context
- Be preachy or lecture them
- Mention their fear/trigger every single time
- Use excessive exclamation marks
- Start with "Hey" or "Hi" every time — vary your openings`;

const generatePrompt = (data: RequestBody): string => {
  const {
    currentLevel,
    sessionsAtCurrentLevel,
    totalSessionsCompleted,
    lastSessionDate,
    currentStreakDays,
    sessionsThisWeek,
    recentSessionSignals,
    onboardingData,
  } = data;

  let daysSinceSession: number | null = null;
  if (lastSessionDate) {
    const last = new Date(lastSessionDate);
    const now = new Date();
    daysSinceSession = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
  }

  let situation = '';
  if (totalSessionsCompleted === 0) {
    situation = 'This is their FIRST session ever. Make it welcoming and low-pressure.';
  } else if (daysSinceSession === 0) {
    situation = 'They already did a session today. Acknowledge that.';
  } else if (daysSinceSession === 1) {
    situation = "They did a session yesterday. They're building consistency.";
  } else if (daysSinceSession !== null && daysSinceSession >= 2 && daysSinceSession <= 3) {
    situation = `It's been ${daysSinceSession} days since their last session. Welcome them back gently, no guilt.`;
  } else if (daysSinceSession !== null && daysSinceSession > 3) {
    situation = `It's been ${daysSinceSession} days since their last session. Be warm, acknowledge life happens, no guilt.`;
  } else {
    situation = 'Normal session day.';
  }

  let performanceNote = '';
  if (recentSessionSignals && recentSessionSignals.length > 0) {
    const hardCount = recentSessionSignals.filter((s) => s.effortLevel === 'hard' || s.effortLevel === 'incomplete').length;
    const easyCount = recentSessionSignals.filter((s) => s.effortLevel === 'easy').length;
    if (hardCount >= 2) {
      performanceNote = 'Recent sessions have been a genuine struggle (based on actual performance data). Acknowledge their effort and be encouraging.';
    } else if (easyCount >= 2) {
      performanceNote = 'Recent sessions have been comfortably easy. They may be ready for more.';
    }
  }

  return `Generate a coach message for ${onboardingData.userName}.

Current state:
- Level: ${currentLevel} of 16
- Sessions at this level: ${sessionsAtCurrentLevel}
- Total sessions completed: ${totalSessionsCompleted}
- Current streak: ${currentStreakDays} days
- Sessions this week: ${sessionsThisWeek}

Situation: ${situation}
${performanceNote ? `Performance pattern: ${performanceNote}` : ''}

Onboarding context (use sparingly, when it adds meaning):
- Why they started: "${onboardingData.triggerStatement || 'not provided'}"
- Who they're doing this for: "${onboardingData.anchorPerson || 'not provided'}"
- Their vision: "${onboardingData.successVision || 'not provided'}"

Write a 2-3 sentence coach message. Be specific to their situation.`;
};

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  let parsedBody: RequestBody | null = null;

  try {
    parsedBody = await req.json() as RequestBody;

    const prompt = generatePrompt(parsedBody);
    const coachMessage = await callClaude(
      SYSTEM_PROMPT,
      [{ role: 'user', content: prompt }],
      undefined,
      150,
    );

    let recommendedVariant: ResponseBody['recommendedVariant'] = 'recommended';
    let adjustmentReason: string | undefined;

    const daysSinceSession = parsedBody.lastSessionDate
      ? Math.floor(
          (Date.now() - new Date(parsedBody.lastSessionDate).getTime()) / (1000 * 60 * 60 * 24),
        )
      : null;

    if (daysSinceSession !== null && daysSinceSession > 3) {
      recommendedVariant = 'quick';
      adjustmentReason = 'Easing back in after a break.';
    } else if (parsedBody.recentSessionSignals && parsedBody.recentSessionSignals.length > 0) {
      const signals = parsedBody.recentSessionSignals;
      const hardOrIncomplete = signals.filter(
        (s) => s.effortLevel === 'hard' || s.effortLevel === 'incomplete',
      ).length;
      const easy = signals.filter((s) => s.effortLevel === 'easy').length;

      if (hardOrIncomplete >= 2) {
        recommendedVariant = 'quick';
        adjustmentReason = 'Recent sessions have been a struggle — a lighter session builds confidence.';
      } else if (hardOrIncomplete === 1 && signals.length >= 2) {
        // One hard session in recent history — stay on recommended, don't push
        recommendedVariant = 'recommended';
        adjustmentReason = undefined;
      } else if (easy >= 2 && parsedBody.sessionsAtCurrentLevel >= 2) {
        recommendedVariant = 'challenge';
        adjustmentReason = 'Recent sessions have been comfortable — time to push a little.';
      }
    }

    const response: ResponseBody = { coachMessage, recommendedVariant, adjustmentReason };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('generate-session-options error:', errMsg);

    return new Response(
      JSON.stringify({
        coachMessage: `Ready when you are, ${parsedBody?.onboardingData?.userName ?? 'there'}. Today's session is waiting.`,
        recommendedVariant: 'recommended',
        error: errMsg,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
