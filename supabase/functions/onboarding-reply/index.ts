import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { callClaude } from '../_shared/claude.ts';

const SYSTEM_PROMPT = `You are a supportive running coach helping someone begin their couch-to-5K journey. You're in the middle of an onboarding conversation, getting to know them before they start.

Your personality:
- Warm and genuine, not cheesy or over-enthusiastic
- You acknowledge EXACTLY what they said — reference their specific words or choices
- Validating without being dismissive
- Brief — 2-4 sentences max, never more
- Use their name naturally, but not in every response
- You speak like a real person, not a corporate app

Never:
- Give generic responses that could apply to anyone
- Use hollow phrases like "That's great!" or "I understand" without specifics
- Be preachy or lecture them
- Make promises you can't keep
- Use emojis`;

interface OnboardingContext {
  step: string;
  userName: string;
  userInput: string | string[];
  previousAnswers?: {
    activityLevel?: string;
    timePreference?: string;
    triggerStatement?: string;
    pastAttempts?: string;
    pastFailureReason?: string;
    primaryFear?: string;
    obstacles?: string[];
    anchorPerson?: string;
    successVision?: string;
  };
}

const STEP_INSTRUCTIONS: Record<string, string> = {
  name: `The user just told you their name. Greet them warmly and briefly — 1-2 sentences. Make it feel personal, not scripted.`,

  activity: `The user just shared their current activity level. Acknowledge where they're starting from without judgment. Make them feel this is a perfectly valid starting point. 2 sentences max.

Activity levels:
- "no_exercise_years": Haven't exercised in years
- "occasionally_walk": Occasionally walk, nothing regular
- "somewhat_active": Somewhat active but inconsistent
- "active_want_run": Active but wants to run specifically`,

  time: `The user just shared when they prefer to exercise. Acknowledge their choice, indicate you'll plan around that window. End with a subtle hint that you're about to go deeper. 2 sentences max.

Time preferences:
- "morning": Before the day starts
- "midday": Lunch break or afternoon
- "evening": After work winds down
- "varies": Depends on the day`,

  trigger: `The user just shared WHY they decided to start TODAY — the specific moment or reason that made them act.

This is powerful. Acknowledge the weight of what they shared. Reference their specific words — don't give a generic "that's a great reason." Make them feel genuinely heard.

End by hinting that this reason will matter later. 2-3 sentences.`,

  'past-attempts-never': `The user said they've never really tried to get fit before — this is a fresh start.

Acknowledge this positively. A fresh start means no bad habits, no past failures haunting them. Don't make them feel inexperienced or behind. 2 sentences.`,

  'what-stopped': `The user shared what stopped them in past attempts.

This may carry shame. Don't add to it. Acknowledge without blame. Make clear that this time you'll adapt when life gets hard — not just disappear when they struggle. Be specific to what they mentioned. 2-3 sentences.`,

  fear: `The user just shared their biggest fear about starting.

This is vulnerable. Honor it — don't dismiss it with "don't worry." Acknowledge the fear is valid AND plant a seed that you'll face it together. Reframe without minimizing. 2-3 sentences.`,

  obstacles: `The user selected obstacles they expect to face (may be multiple).

Acknowledge you now know what to watch for. Reference the actual obstacles they listed. The message: when these hit (not if), you'll be ready to adapt. 2-3 sentences.`,

  anchor: `The user shared who they're doing this for — beyond themselves.

This is emotional. Honor whoever or whatever they named. If it's their kids, partner, parents — make that connection feel real and meaningful. If they said "just for me" — validate that fully. Self-investment is enough. 2-3 sentences.`,

  vision: `The user shared what changes in their life if they succeed.

This is their personal definition of success. Reflect the power of what they described. Commit to remembering it. End with forward momentum — something like "now let's make it real" — since the commitment phase comes next. 2-3 sentences.`,

  confirmation: `The user just confirmed that the summary you've built of them is accurate — you now truly know who they are.

This is a significant moment. You have their story: why they started, what stopped them before, what they fear, who they're doing it for, and what they want. Reference something specific from their journey that feels most meaningful. Make them feel genuinely known, not profiled. Bridge briefly to Day 1 — the real thing starts now. 2-3 sentences.`,

  'start-day': `The user just committed to starting. "What they just shared" is either "today" or "tomorrow".

- If "today": Match that energy. Be direct and exciting — not cheesy. Today is the day. First session is just 10 minutes. Just start.
- If "tomorrow": Honor the commitment. This is real. Help them mentally prepare — they know what's coming, and that's a strength. Anticipate Day 1 together.

This is the send-off. Make it land. 2-3 sentences.`,
};

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { step, userName, userInput, previousAnswers }: OnboardingContext = await req.json();

    const instruction = STEP_INSTRUCTIONS[step];
    if (!instruction) {
      throw new Error(`Unknown step: ${step}`);
    }

    const formattedInput = Array.isArray(userInput) ? userInput.join(', ') : userInput;

    const contextParts: string[] = [];
    if (previousAnswers) {
      if (previousAnswers.activityLevel) contextParts.push(`Activity level: ${previousAnswers.activityLevel}`);
      if (previousAnswers.timePreference) contextParts.push(`Preferred time: ${previousAnswers.timePreference}`);
      if (previousAnswers.triggerStatement) contextParts.push(`Why they started: "${previousAnswers.triggerStatement}"`);
      if (previousAnswers.pastAttempts) contextParts.push(`Past attempts: ${previousAnswers.pastAttempts}`);
      if (previousAnswers.pastFailureReason) contextParts.push(`What stopped them: "${previousAnswers.pastFailureReason}"`);
      if (previousAnswers.primaryFear) contextParts.push(`Their fear: "${previousAnswers.primaryFear}"`);
      if (previousAnswers.obstacles?.length) contextParts.push(`Obstacles: ${previousAnswers.obstacles.join(', ')}`);
      if (previousAnswers.anchorPerson) contextParts.push(`Who they're doing this for: "${previousAnswers.anchorPerson}"`);
      if (previousAnswers.successVision) contextParts.push(`Their vision of success: "${previousAnswers.successVision}"`);
    }

    const contextBlock = contextParts.length > 0
      ? `\n\nContext from earlier in the conversation:\n${contextParts.join('\n')}`
      : '';

    const userMessage = `${instruction}${contextBlock}

User's name: ${userName}

What they just shared:
"${formattedInput}"

Write your coach response:`;

    const coachMessage = await callClaude(SYSTEM_PROMPT, [{ role: 'user', content: userMessage }], undefined, 200);

    return new Response(JSON.stringify({ coachMessage, success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('onboarding-reply error:', errMsg);

    return new Response(
      JSON.stringify({ coachMessage: '', success: false, error: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
