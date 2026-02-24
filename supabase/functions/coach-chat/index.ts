import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { callClaude } from '../_shared/claude.ts';

interface ConversationMessage {
  role: 'user' | 'coach';
  content: string;
}

interface AvailableSession {
  title: string;
  durationMinutes: number;
}

interface ChatContext {
  userName: string;
  currentLevel: number;
  totalSessions: number;
  currentStreak: number;
  lastSessionDate: string | null;
  triggerStatement: string;
  anchorPerson: string;
  primaryFear: string;
  successVision: string;
  recentSessions: {
    date: string;
    title: string;
    feedback: string;
  }[];
  availableSessions: {
    recommended: AvailableSession;
    quick: AvailableSession;
    challenge: AvailableSession;
    push: AvailableSession;
  };
}

interface RequestBody {
  message: string;
  imageBase64?: string;
  context: ChatContext;
  conversationHistory: ConversationMessage[];
}

interface CoachingDecision {
  shouldAccommodate: boolean;
  shouldPush: boolean;
  pushIntensity: 'gentle' | 'moderate' | 'firm';
  reason: string;
  isHealthConcern: boolean;
}

// ─── System Prompt ─────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an AI running coach for MarchBuddy, a couch-to-5K app. Your job is to help users become runners — not to be their friend who lets them off the hook.

YOUR COACHING PHILOSOPHY:
1. The goal is CONSISTENCY, especially early on. A 10-minute walk beats a skipped day every time.
2. "I'm tired" is usually not a reason to skip — it's a reason to do a lighter session.
3. The habit of showing up matters more than any single workout.
4. You're supportive but you have backbone. You don't just agree with everything.
5. You remember WHY they started and use it when they need motivation.

YOUR CAPABILITIES IN THE APP:
You can actually adjust today's workout plan in real-time — use this power deliberately.
- To switch to a LIGHTER session: say "I've switched you to the quick session" or "I've adjusted today's plan to the quick version"
- To switch to a HARDER challenge (when they're clearly ready): say "I've switched you to the challenge session" or "I've bumped you up to the push session"
- To give a full rest day (injury/illness only): say "I've taken today off the schedule" or "I'm giving you a rest day today"

IMPORTANT: The AVAILABLE SESSIONS section in the context shows the EXACT durations for this user's level. Always use those real numbers — never invent a duration. If the quick session is 14 minutes, say 14 minutes. If it's 10, say 10. Never promise a duration you haven't been given.

Only use the trigger phrases above when you genuinely want to change the plan. The app listens for them and acts immediately. Never tell the user you "can't change" the plan — you CAN. Don't use this language if you're just discussing options casually.

WHEN TO ACCOMMODATE (be flexible):
- Genuine injury or pain (always take seriously)
- Illness (fever, vomiting, etc.)
- Major life emergency
- User has been very consistent (5+ day streak) and just needs ONE lighter day
- User completed a hard session yesterday and needs recovery

WHEN TO PUSH BACK (encourage them to show up):
- "I'm tired" but no injury — suggest shorter session, not skip
- They've already missed 2+ days — the habit is at risk
- Early in program (first 2 weeks / under 10 sessions) — consistency is critical
- Pattern of finding excuses — address it directly but kindly
- "Don't feel like it" — this is exactly when showing up matters

WHEN TO BE FIRM (with love):
- Multiple skip requests in a week
- Excuses that don't hold up ("too busy" when they have 10 minutes)
- They're about to break a streak for no real reason
- They're self-sabotaging based on their stated fear

HOW TO PUSH BACK EFFECTIVELY:
- Acknowledge their feeling first ("I hear you, you're tired")
- Reframe the ask ("What if we just did 10 minutes?")
- Connect to their WHY ("Remember, you're doing this for your kids")
- Make it small ("Just put on your shoes and step outside")
- Remind them of progress ("You've done 5 sessions — don't let that slip")

NEVER:
- Let them skip without at least suggesting a minimal alternative
- Be preachy or guilt-trip them
- Ignore genuine health concerns
- Be a pushover who just agrees with everything
- Forget that your job is to help them become fit
- Tell the user you can't change their plan — you always can

For image messages: briefly describe what you see, then respond naturally as their coach.
Keep responses conversational — 2-4 sentences typically, more only when you need to push back firmly.`;

// ─── Coaching Decision Engine ───────────────────────────────────────────────

function evaluateRequest(
  userMessage: string,
  context: ChatContext,
  conversationHistory: ConversationMessage[],
): CoachingDecision {
  const msgLower = userMessage.toLowerCase();

  // Health/medical — always accommodate, no questions
  const healthKeywords = ['hurt', 'pain', 'injury', 'injured', 'sick', 'fever', 'vomit', 'doctor', 'hospital', 'surgery', 'illness', 'unwell', 'sprain', 'pulled'];
  if (healthKeywords.some((k) => msgLower.includes(k))) {
    return {
      shouldAccommodate: true,
      shouldPush: false,
      pushIntensity: 'gentle',
      reason: 'Health concern — always accommodate',
      isHealthConcern: true,
    };
  }

  // Check if this looks like a skip/reduce request at all
  const skipKeywords = ['skip', 'tired', 'exhausted', 'rest', 'tomorrow', "don't feel", 'not feeling', 'maybe later', 'take a day', 'take the day', 'miss today', 'cancel'];
  const isSkipRequest = skipKeywords.some((k) => msgLower.includes(k));

  // If not a skip request, just respond naturally
  if (!isSkipRequest) {
    return {
      shouldAccommodate: true,
      shouldPush: false,
      pushIntensity: 'gentle',
      reason: 'Not a skip request — respond naturally',
      isHealthConcern: false,
    };
  }

  // Calculate consistency signals
  const daysSinceLastSession = context.lastSessionDate
    ? Math.floor((Date.now() - new Date(context.lastSessionDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const isConsistentUser = context.currentStreak >= 5;
  const isMissingDays = daysSinceLastSession !== null && daysSinceLastSession >= 2;
  const isEarlyInProgram = context.totalSessions < 10;

  // Count skip requests in recent conversation
  const recentSkipRequests = conversationHistory.filter(
    (m) =>
      m.role === 'user' &&
      skipKeywords.some((k) => m.content.toLowerCase().includes(k)),
  ).length;
  const hasAvoidancePattern = recentSkipRequests >= 2;

  // Decision tree
  if (isConsistentUser && !hasAvoidancePattern) {
    return {
      shouldAccommodate: true,
      shouldPush: true,
      pushIntensity: 'gentle',
      reason: 'Consistent user — earned flexibility, but still encourage some movement',
      isHealthConcern: false,
    };
  }

  if (hasAvoidancePattern) {
    return {
      shouldAccommodate: false,
      shouldPush: true,
      pushIntensity: 'firm',
      reason: 'Pattern of avoidance — firm push, reference their fear and anchor',
      isHealthConcern: false,
    };
  }

  if (isMissingDays) {
    return {
      shouldAccommodate: false,
      shouldPush: true,
      pushIntensity: 'moderate',
      reason: `Already missed ${daysSinceLastSession} days — habit is at risk`,
      isHealthConcern: false,
    };
  }

  if (isEarlyInProgram) {
    return {
      shouldAccommodate: false,
      shouldPush: true,
      pushIntensity: 'moderate',
      reason: 'Early in program — consistency is critical right now',
      isHealthConcern: false,
    };
  }

  // Default: gentle push toward a lighter session
  return {
    shouldAccommodate: false,
    shouldPush: true,
    pushIntensity: 'gentle',
    reason: 'Standard request — suggest lighter session instead of skipping',
    isHealthConcern: false,
  };
}

// ─── Prompt Builder ─────────────────────────────────────────────────────────

function buildPrompt(body: RequestBody): string {
  const { context, conversationHistory, message } = body;

  const decision = evaluateRequest(message, context, conversationHistory);

  const daysSince = context.lastSessionDate
    ? Math.floor((Date.now() - new Date(context.lastSessionDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const { availableSessions: s } = context;

  let ctx = `USER CONTEXT:
Name: ${context.userName}
Current Level: ${context.currentLevel} of 16
Total Sessions: ${context.totalSessions}
Current Streak: ${context.currentStreak} days
Days Since Last Session: ${daysSince !== null ? `${daysSince} day${daysSince === 1 ? '' : 's'}` : 'Never exercised yet'}

AVAILABLE SESSIONS TODAY (use these EXACT durations — never invent numbers):
- Recommended: "${s.recommended.title}" (${s.recommended.durationMinutes} min)
- Quick:       "${s.quick.title}" (${s.quick.durationMinutes} min)
- Challenge:   "${s.challenge.title}" (${s.challenge.durationMinutes} min)
- Push:        "${s.push.title}" (${s.push.durationMinutes} min)

WHY THEY STARTED: "${context.triggerStatement}"
WHO THEY'RE DOING IT FOR: "${context.anchorPerson}"
THEIR FEAR: "${context.primaryFear}"
THEIR VISION: "${context.successVision}"`;

  if (context.recentSessions.length > 0) {
    ctx += '\n\nRECENT SESSIONS:';
    for (const s of context.recentSessions) {
      ctx += `\n- ${s.date}: ${s.title} (${s.feedback})`;
    }
  }

  // Inject coaching guidance for all skip-related scenarios (including health)
  if (decision.shouldPush || decision.isHealthConcern) {
    let guidance: string;

    if (decision.isHealthConcern) {
      guidance = `This is a health or injury situation. Take it seriously and confirm they should rest.
If they should skip today entirely, say exactly: "I've taken today off the schedule"
Don't push them to exercise through illness or injury.`;
    } else if (decision.shouldAccommodate && decision.pushIntensity === 'gentle') {
      // Consistent user
      guidance = `They've earned some flexibility. If they want lighter, offer the quick session and say: "I've switched you to the quick session"
Still encourage some movement — even a short walk counts.`;
    } else if (decision.pushIntensity === 'firm') {
      // Avoidance pattern
      guidance = `This is the moment to be firm — they're showing a pattern of avoidance.
Push back directly. Reference their fear: "${context.primaryFear}"
The minimum floor is the quick session. If they agree to it, say: "I've switched you to the quick session"
Be direct but not harsh. One or two skips is how quitting starts.`;
    } else if (decision.pushIntensity === 'moderate') {
      // Missing days or early in program
      guidance = `Push back — the habit matters more than any single workout.
Offer the quick session as a fair compromise. If they agree, say: "I've switched you to the quick session"
Reference their WHY. Make it feel achievable, not overwhelming.`;
    } else {
      // Default gentle push
      guidance = `Gently redirect — suggest the quick session as a lighter alternative.
If they prefer it over skipping entirely, say: "I've switched you to the quick session"
Acknowledge their feeling first, then reframe the ask.`;
    }

    ctx += `\n\nCOACHING GUIDANCE FOR THIS MESSAGE:
Decision: ${decision.reason}
${guidance}
Remember their WHY: "${context.triggerStatement}"
Remember who they're doing this for: "${context.anchorPerson}"`;
  }

  let conversation = '\n\nCONVERSATION:';
  for (const msg of conversationHistory) {
    const speaker = msg.role === 'user' ? context.userName : 'Coach';
    conversation += `\n${speaker}: ${msg.content}`;
  }
  conversation += `\n${context.userName}: ${message}`;
  if (body.imageBase64) {
    conversation += ' [User shared an image]';
  }
  conversation += '\n\nCoach:';

  return ctx + conversation;
}

// ─── Adjustment Detection ───────────────────────────────────────────────────

function detectAdjustment(
  userMessage: string,
  coachReply: string,
): { type: string; suggestedVariant: string } | null {
  const replyLower = coachReply.toLowerCase();
  const msgLower = userMessage.toLowerCase();

  // 1. Rest day — highest priority
  const isRestDay =
    replyLower.includes("taken today off") ||
    replyLower.includes("giving you a rest day") ||
    replyLower.includes("rest day today") ||
    replyLower.includes("take today off") ||
    replyLower.includes("skip today") ||
    (replyLower.includes("rest") &&
      ['hurt', 'pain', 'injury', 'injured', 'sick', 'fever'].some((k) => msgLower.includes(k)));

  if (isRestDay) {
    return { type: 'injury_rest', suggestedVariant: 'rest' };
  }

  // 2. Challenge/push intensity increase — check before quick to avoid false match on "i've switched"
  const isChallenge =
    replyLower.includes("bumped up") ||
    (replyLower.includes("switched") && replyLower.includes("challenge")) ||
    (replyLower.includes("switched") && replyLower.includes("push session")) ||
    replyLower.includes("challenge session") && (replyLower.includes("i've switched") || replyLower.includes("switching you"));

  if (isChallenge) {
    return { type: 'increase_intensity', suggestedVariant: 'challenge' };
  }

  // 3. Quick/lighter session
  const isQuick =
    replyLower.includes("i've switched you to the quick") ||
    replyLower.includes("i've adjusted today's plan to the quick") ||
    replyLower.includes("i've adjusted today") ||
    replyLower.includes("switching you to the quick") ||
    replyLower.includes("quick session") ||
    replyLower.includes("quick version") ||
    replyLower.includes("i've switched") ||
    replyLower.includes("i've adjusted") ||
    replyLower.includes("lighter") ||
    replyLower.includes("shorter") ||
    replyLower.includes("10 minute");

  if (isQuick) {
    return { type: 'reduce_duration', suggestedVariant: 'quick' };
  }

  return null;
}

// ─── Handler ────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body: RequestBody = await req.json();
    const prompt = buildPrompt(body);

    const reply = await callClaude(
      SYSTEM_PROMPT,
      [{ role: 'user', content: prompt }],
      body.imageBase64,
      400,
    );

    const adjustment = detectAdjustment(body.message, reply);

    return new Response(
      JSON.stringify({
        reply,
        shouldAdjustPlan: adjustment !== null,
        adjustment,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('coach-chat error:', errMsg);
    return new Response(
      JSON.stringify({
        reply: "I'm here, but having a moment. Try again?",
        shouldAdjustPlan: false,
        adjustment: null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
