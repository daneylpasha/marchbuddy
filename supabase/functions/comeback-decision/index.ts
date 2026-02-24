import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { callClaudeJSON, } from '../_shared/claude.ts';
import { handleCors, corsHeaders } from '../_shared/cors.ts';

interface ComebackContext {
  daysSinceLastSession: number;
  previousLevel: number;
  totalSessionsCompleted: number;
  bestStreakDays: number;
  lastSessionFeedback: string | null;
  userName: string;
  triggerStatement: string;
  anchorPerson: string;
  primaryFear: string;
  fitnessFeeling?: string;
  additionalContext?: string;
}

interface ComebackDecision {
  recommendedLevel: number;
  reasoning: string;
  encouragement: string;
  suggestFitnessCheck: boolean;
}

const SYSTEM_PROMPT = `You are an AI running coach deciding what level a returning user should start at after a break from MarchBuddy, a couch-to-5K app.

YOUR GOAL: Find the RIGHT level — challenging enough to be worthwhile, easy enough to succeed and rebuild confidence.

THE 16-LEVEL PROGRAM:
- Levels 1-2: Walking only (10-15 min)
- Levels 3-4: Introducing short jog intervals (18-20 min)
- Levels 5-6: Building run endurance (22-25 min)
- Levels 7-8: More running than walking (28-30 min)
- Levels 9-10: Long run intervals (32-35 min)
- Levels 11-12: Continuous running begins (35-38 min)
- Levels 13-14: Building to 5K distance (42-48 min)
- Levels 15-16: 5K achievement (50+ min)

FACTORS TO WEIGH:

1. Gap Duration (primary factor):
   - 7-14 days: Minimal fitness loss, maybe -1 level
   - 14-21 days: Some detraining, typically -1 to -2 levels
   - 21-30 days: Noticeable fitness loss, typically -2 to -3 levels
   - 30-60 days: Significant detraining, typically -3 to -4 levels
   - 60+ days: Major fitness loss, consider dropping to Level 1-3

2. Previous Level:
   - Higher levels have more complex sessions, bigger drop may be needed
   - Lower levels (1-4) may not need much adjustment

3. Experience (total sessions):
   - 50+ sessions: Body has muscle memory, less regression needed
   - 20-50 sessions: Moderate retention
   - <20 sessions: Fitness wasn't fully established

4. Their Fitness Self-Assessment (if provided):
   - "too_easy": They feel strong, less drop needed
   - "comfortable": Standard drop
   - "challenging": Maybe drop one more level
   - "too_hard": Definitely drop extra, prioritize safety

5. Additional Context:
   - Illness/injury mentioned → Be conservative, prioritize safety
   - "Been active elsewhere" (gym, cycling) → Less drop needed
   - Life stress mentioned → Be supportive, moderate drop
   - "Want fresh start" → Respect their wish, go lower

DECISION LOGIC:
- Be dynamic, not formulaic
- Err on the side of slightly easier (success builds momentum)
- Never drop below Level 1
- Never recommend same level after 14+ day gap (always some regression)
- Maximum drop is usually to Level 1-2, even after months

TONE:
- Warm and supportive, never judgmental
- Acknowledge the break matter-of-factly
- Focus on the smart comeback, not what was lost
- Make them feel this is strategic, not punishment
- Reference their personal motivation when appropriate

Return ONLY valid JSON matching this shape exactly:
{
  "recommendedLevel": <number 1-16>,
  "reasoning": "<2-3 sentences explaining your logic>",
  "encouragement": "<1-2 sentences of genuine, personalized encouragement>",
  "suggestFitnessCheck": <boolean>
}`;

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const context: ComebackContext = await req.json();

    const userPrompt = `Analyze this returning user and recommend a starting level:

USER PROFILE:
- Name: ${context.userName}
- Days since last session: ${context.daysSinceLastSession}
- Previous level: ${context.previousLevel} of 16
- Total sessions ever completed: ${context.totalSessionsCompleted}
- Best streak achieved: ${context.bestStreakDays} days
- Last session feedback: ${context.lastSessionFeedback ?? 'Unknown'}

THEIR MOTIVATION:
- Why they started: "${context.triggerStatement || 'Not specified'}"
- Who they're doing it for: "${context.anchorPerson || 'Not specified'}"
- Their fear: "${context.primaryFear || 'Not specified'}"
${
  context.fitnessFeeling
    ? `
SELF-ASSESSMENT:
They said doing their previous Level ${context.previousLevel} session would feel: "${context.fitnessFeeling}"
`
    : ''
}${
  context.additionalContext
    ? `
ADDITIONAL CONTEXT FROM USER:
"${context.additionalContext}"
`
    : ''
}
Based on all this information, what level should ${context.userName} start at?

Respond with JSON only, no other text.`;

    let decision = await callClaudeJSON<ComebackDecision>(
      SYSTEM_PROMPT,
      [{ role: 'user', content: userPrompt }],
      undefined,
      500,
    );

    // Validate and clamp level
    decision.recommendedLevel = Math.max(1, Math.min(16, Math.round(decision.recommendedLevel)));

    return new Response(JSON.stringify(decision), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in comeback-decision:', error);

    return new Response(
      JSON.stringify({
        recommendedLevel: 1,
        reasoning: "Let's start fresh and build up safely together.",
        encouragement: 'Welcome back! Ready when you are.',
        suggestFitnessCheck: false,
      } satisfies ComebackDecision),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
