import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { callClaudeJSON, } from '../_shared/claude.ts';
import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { calculateLevel, FitnessFeeling } from './calculateLevel.ts';

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
  fitnessFeeling?: FitnessFeeling;
  additionalContext?: string;
}

interface ComebackDecision {
  recommendedLevel: number;
  reasoning: string;
  encouragement: string;
  suggestFitnessCheck: boolean;
}

// The level decision lives in calculateLevel.ts (deterministic). Claude is
// here only to wrap that decision in warm, personalized prose — it does NOT
// pick the level. This prompt makes that boundary explicit so the model
// doesn't try to "correct" the number we pass in.
const SYSTEM_PROMPT = `You are an AI running coach for MarchBuddy, a couch-to-5K app.

A returning user has been away for a while. Our coaching system has already decided what level they should restart at based on the gap, their self-assessment, and program rules. Your job is NOT to second-guess the level — your job is to explain it warmly and motivate them.

YOU WILL BE GIVEN:
- The recommended level (already decided)
- The user's previous level
- How long they've been away
- Their self-assessment (if provided)
- Their personal motivation (why they started, who for, what they fear)

YOUR JOB:
1. Write a short "reasoning" (2-3 sentences) that explains WHY this level is the right choice based on the gap and how they said they'd feel. Acknowledge the math without sounding robotic.
2. Write a short "encouragement" (1-2 sentences) that references their personal motivation when relevant.

TONE:
- Warm and supportive, never judgmental
- Acknowledge the break matter-of-factly, no guilt-tripping
- Make the recommendation feel strategic, not punitive
- Reference their trigger / anchor person / fear naturally if it fits — don't force it

THE 16-LEVEL PROGRAM (for context):
- Levels 1-2: Walking only (10-15 min)
- Levels 3-4: Short jog intervals (18-20 min)
- Levels 5-6: Building run endurance (22-25 min)
- Levels 7-8: More running than walking (28-30 min)
- Levels 9-10: Long run intervals (32-35 min)
- Levels 11-12: Continuous running begins (35-38 min)
- Levels 13-14: Building to 5K distance (42-48 min)
- Levels 15-16: 5K achievement (50+ min)

CRITICAL: Do NOT mention or suggest a different level than the one you were given. Do NOT include the number in "recommendedLevel" — that field is filled by our system, not by you.

Return ONLY valid JSON matching this shape exactly:
{
  "reasoning": "<2-3 sentences>",
  "encouragement": "<1-2 sentences>",
  "suggestFitnessCheck": <boolean — true only if you genuinely think a fitness check would help future decisions>
}`;

function fallbackReasoning(
  context: ComebackContext,
  recommendedLevel: number,
): string {
  if (recommendedLevel === context.previousLevel) {
    return `After ${context.daysSinceLastSession} days, your self-assessment shows you're ready to pick up right where you left off — staying at Level ${recommendedLevel} keeps the momentum going.`;
  }
  const drop = context.previousLevel - recommendedLevel;
  return `A ${context.daysSinceLastSession}-day break means a small step back protects your progress — Level ${recommendedLevel} (down ${drop} from where you were) is challenging enough to feel like real work, easy enough to rebuild consistency.`;
}

function fallbackEncouragement(context: ComebackContext): string {
  const name = context.userName || 'you';
  return `Welcome back, ${name}. The best runners aren't the ones who never stop — they're the ones who restart smart.`;
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const context: ComebackContext = await req.json();

    // Decide the level deterministically. Claude never sees the rules
    // table — it only sees the final number.
    const calc = calculateLevel({
      previousLevel: context.previousLevel,
      daysSinceLastSession: context.daysSinceLastSession,
      fitnessFeeling: context.fitnessFeeling,
    });
    const recommendedLevel = calc.recommendedLevel;

    const userPrompt = `Generate warm copy for a returning user.

RECOMMENDED LEVEL (do not change): ${recommendedLevel}
Previous level: ${context.previousLevel}
Days away: ${context.daysSinceLastSession}
Level drop applied: ${calc.levelDrop} (base ${calc.baseDrop} + self-assessment modifier ${calc.feelingModifier})

USER:
- Name: ${context.userName}
- Total sessions ever: ${context.totalSessionsCompleted}
- Best streak: ${context.bestStreakDays} days
- Last session feedback: ${context.lastSessionFeedback ?? 'Unknown'}
${
  context.fitnessFeeling
    ? `- Self-assessment: doing their previous Level ${context.previousLevel} session right now would feel "${context.fitnessFeeling}"`
    : '- Self-assessment: not provided'
}

THEIR MOTIVATION:
- Why they started: "${context.triggerStatement || 'Not specified'}"
- Who they're doing it for: "${context.anchorPerson || 'Not specified'}"
- Their fear: "${context.primaryFear || 'Not specified'}"
${
  context.additionalContext
    ? `\nADDITIONAL CONTEXT FROM USER:\n"${context.additionalContext}"\n`
    : ''
}
Write the reasoning (2-3 sentences) and encouragement (1-2 sentences) for going to Level ${recommendedLevel}. JSON only.`;

    let reasoning = '';
    let encouragement = '';
    let suggestFitnessCheck = false;

    try {
      const aiResponse = await callClaudeJSON<{
        reasoning: string;
        encouragement: string;
        suggestFitnessCheck: boolean;
      }>(SYSTEM_PROMPT, [{ role: 'user', content: userPrompt }], undefined, 400);
      reasoning = aiResponse.reasoning?.trim() ?? '';
      encouragement = aiResponse.encouragement?.trim() ?? '';
      suggestFitnessCheck = Boolean(aiResponse.suggestFitnessCheck);
    } catch (aiError) {
      console.warn('Claude reasoning generation failed, using fallback:', aiError);
    }

    // If Claude returned empty or unusable copy, fill in mechanical fallback
    // so the user never sees a blank screen. Level is already locked in.
    if (!reasoning) reasoning = fallbackReasoning(context, recommendedLevel);
    if (!encouragement) encouragement = fallbackEncouragement(context);

    const decision: ComebackDecision = {
      recommendedLevel,
      reasoning,
      encouragement,
      suggestFitnessCheck,
    };

    return new Response(JSON.stringify(decision), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in comeback-decision:', error);
    return new Response(
      JSON.stringify({ error: 'AI unavailable' }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
