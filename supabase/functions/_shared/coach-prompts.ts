// ============================================================================
// MarchBuddy V2 — Proactive Coach Messages: prompts + fallback pools
//
// One file so both the sender Edge Function and any future tooling share the
// same source of truth.
//
// PM constraints (from spec §4):
//   - Under 200 chars (one push glance + 1 chat bubble)
//   - Max 1 emoji, often zero
//   - No guilt, no fake hype
//   - Tone: knowledgeable friend who happens to coach
//   - For missed sessions: acknowledge → normalize → forward-look. Never dwell.
// ============================================================================

export type CoachTriggerType =
  | 'session_morning'
  | 'post_session'
  | 'missed_session'
  | 'weekly_recap';

// ─── Shared system prompt ─────────────────────────────────────────────────

export const COACH_PROACTIVE_SYSTEM_PROMPT = `You are the AI running coach for MarchBuddy, a couch-to-5K app. You are writing a SHORT proactive message that will appear in the user's chat AND as a push notification — they did not ask for it.

HARD RULES (these break the product if violated):
- Under 200 characters total. Aim for 60-140.
- One sentence, two max. Period.
- Max 1 emoji. Default to zero.
- Never guilt-trip about missed sessions.
- Never fake hype ("YOU GOT THIS!", "Crushing it!").
- Never ask a question that requires an answer the user can't act on.
- Never reference their name awkwardly — use it only if it feels natural; skipping it is fine.
- Do NOT prefix with "Hey [name]," every time. Vary openings.
- NEVER invent numbers (duration in minutes, distance in km, calories,
  streak count) that were not explicitly provided in the user context.
  If a number isn't given, reference the activity without quantifying it.
  "Today's session is on the schedule" is fine; "Today's 20-min run"
  is NOT fine unless the context explicitly says 20 min.

TONE:
- Knowledgeable friend who happens to coach. Not a drill sergeant. Not a therapist.
- Direct and warm. Specific over generic.
- Reference the user's actual context (level, last session feedback, today's plan) when relevant.

OUTPUT FORMAT:
- Plain text only. No quotation marks around the message. No markdown.
- Return ONLY the message — nothing else, no preface, no explanation.`;

// ─── Per-trigger guidance ────────────────────────────────────────────────

export function getTriggerGuidance(trigger: CoachTriggerType): string {
  switch (trigger) {
    case 'session_morning':
      return `THIS MESSAGE: Sent ~2 hours before today's scheduled session.
GOAL: Plant the session in their head, signal you're paying attention, lower activation energy.
INCLUDE if available: session duration + type ("25 min easy run", "interval session").
DO say: matter-of-fact framing ("Today's the day", "On the schedule today"), what's planned, that you'll be around after.
DO NOT say: "good luck", "don't forget", "make sure you...".`;

    case 'post_session':
      return `THIS MESSAGE: Sent ~4 hours after they finished a session.
GOAL: Acknowledge the work, validate recovery, keep the relationship warm. No new asks.
INCLUDE if available: a specific nod to the session (duration, that they pushed/took it easy, feedback rating if low or high).
DO say: brief recognition + one recovery/sleep/hydration tip relevant to the session intensity.
DO NOT say: "next session is...", "ready for tomorrow?", anything that points to the next workout.`;

    case 'missed_session':
      return `THIS MESSAGE: Sent next day at 10am after they missed a scheduled session.
GOAL: Normalize the miss, remove shame, point forward without pressuring.
STRUCTURE: acknowledge → normalize → forward-look. NEVER dwell on the miss.
DO say: brief "no big deal" framing, that consistency is a long game, today is a fresh option.
DO NOT say: "you missed", "what happened?", "let's get back on track" (cliche), anything that sounds like a parent.`;

    case 'weekly_recap':
      return `THIS MESSAGE: Sent Sunday 7pm local time.
GOAL: One-line proof that you noticed the week, end with a forward-looking note.
INCLUDE: actual numbers when given (sessions completed, total minutes/distance). If zero sessions: a gentle, non-judgmental "fresh week ahead" framing.
DO say: specific number + brief read of the week.
DO NOT say: "great job!", "amazing week!", "let's crush next week".`;
  }
}

// ─── Context shape ────────────────────────────────────────────────────────

export interface CoachMessageContext {
  userFirstName: string | null;
  currentLevel: number | null;
  currentLevelName: string | null; // e.g. "Building Momentum"
  sessionsAtCurrentLevel: { completed: number; total: number } | null;
  currentStreakDays: number;
  lastRestDayDate: string | null;
  recentSessions: {
    date: string;
    title: string;
    completed: boolean; // false if skipped
    feedbackRating: string | null;
  }[];
  // session_morning only
  todaysPlannedSession?: {
    title: string;
    // null = duration unknown. Claude is instructed not to invent a number.
    durationMinutes: number | null;
    difficulty: 'easy' | 'moderate' | 'hard' | null;
  } | null;
  // weekly_recap only
  weekStats?: {
    sessionsCompleted: number;
    totalDistanceKm: number;
    totalDurationMinutes: number;
  } | null;
}

export function buildUserPrompt(
  trigger: CoachTriggerType,
  ctx: CoachMessageContext,
): string {
  const name = ctx.userFirstName?.trim() || null;
  const lines: string[] = [];

  lines.push(getTriggerGuidance(trigger));
  lines.push('');
  lines.push('USER CONTEXT:');
  if (name) lines.push(`- First name: ${name}`);
  if (ctx.currentLevel) {
    const lvl = ctx.currentLevelName
      ? `Level ${ctx.currentLevel}: ${ctx.currentLevelName}`
      : `Level ${ctx.currentLevel}`;
    lines.push(`- Current level: ${lvl}`);
  }
  if (ctx.sessionsAtCurrentLevel) {
    lines.push(
      `- Sessions at level: ${ctx.sessionsAtCurrentLevel.completed} of ${ctx.sessionsAtCurrentLevel.total}`,
    );
  }
  if (ctx.currentStreakDays > 0) {
    lines.push(`- Current streak: ${ctx.currentStreakDays} days`);
  }
  if (ctx.lastRestDayDate) {
    lines.push(`- Last rest day: ${ctx.lastRestDayDate}`);
  }
  if (ctx.recentSessions.length > 0) {
    lines.push('- Recent sessions (newest first):');
    for (const s of ctx.recentSessions) {
      const tag = s.completed ? 'completed' : 'skipped';
      const rating = s.feedbackRating ? `, rated ${s.feedbackRating}` : '';
      lines.push(`    • ${s.date}: ${s.title} (${tag}${rating})`);
    }
  }

  if (trigger === 'session_morning' && ctx.todaysPlannedSession) {
    const p = ctx.todaysPlannedSession;
    const durationStr =
      p.durationMinutes !== null && p.durationMinutes > 0
        ? `${p.durationMinutes} min`
        : 'duration unknown — DO NOT invent a number, just reference the session by title';
    lines.push(
      `- TODAY'S PLANNED SESSION: "${p.title}", ${durationStr}, difficulty: ${p.difficulty ?? 'unknown'}`,
    );
  }
  if (trigger === 'weekly_recap' && ctx.weekStats) {
    const w = ctx.weekStats;
    lines.push(
      `- THIS WEEK SO FAR: ${w.sessionsCompleted} sessions, ${w.totalDistanceKm.toFixed(1)}km, ${w.totalDurationMinutes} min total`,
    );
  }

  lines.push('');
  lines.push('Write the message now. Plain text, under 200 characters, no quotes, no preface.');
  return lines.join('\n');
}

// ─── Fallback message pools ──────────────────────────────────────────────
// Used if Claude API fails or times out. {{name}} is replaced if a first
// name is available, otherwise the token is removed cleanly.

const FALLBACK_SESSION_MORNING = [
  "Today's session is on the schedule. I'll be around when you wrap.",
  "Quick reminder — today's run is queued up. Take it at your pace.",
  "On the plan today: your scheduled session. Nothing fancy, just show up.",
  "Today's the day{{nameComma}}. The plan's ready when you are.",
  "Heads up, today's session is locked in. Walk-warm-up counts as starting.",
  "Your session's on deck today. The first 5 minutes are always the hardest.",
  "Plan for today's posted. Step out the door and the rest follows.",
];

const FALLBACK_POST_SESSION = [
  "Solid work today. Hydrate, eat, sleep — recovery is the second half of the workout.",
  "Session done. Easy on yourself the rest of the day — that's where the gains land.",
  "Strong showing today. Stretch a little, get good sleep.",
  "Workout in the books. Recovery counts as much as the run itself.",
  "Nice one. Take it easy tonight — your body's adapting right now.",
  "That's another one logged. Protein, water, sleep. In that order.",
];

const FALLBACK_MISSED_SESSION = [
  "Yesterday didn't happen — that's fine. The plan keeps moving forward today.",
  "No drama about yesterday. A 10-minute walk today resets the rhythm.",
  "Skipped days happen. Today's session is here whenever you want it.",
  "One off-day doesn't change the trajectory. Pick it back up when you're ready.",
  "Yesterday's behind us. Fresh shot today — even a short session counts.",
  "Life happens. Today's a new line on the schedule.",
];

const FALLBACK_WEEKLY_RECAP = [
  "Week wrapped. Onto the next one — Sunday's a good night to look at what's ahead.",
  "Another week down. Quick scan of what's coming this week wouldn't hurt.",
  "Week's in the books. New week, same coach{{nameComma}}.",
  "End of the week. Fresh slate tomorrow — that's the part that matters.",
  "Solid week or rough one, doesn't matter — Monday resets it.",
];

const POOLS: Record<CoachTriggerType, string[]> = {
  session_morning: FALLBACK_SESSION_MORNING,
  post_session: FALLBACK_POST_SESSION,
  missed_session: FALLBACK_MISSED_SESSION,
  weekly_recap: FALLBACK_WEEKLY_RECAP,
};

function fillName(template: string, firstName: string | null): string {
  if (firstName && firstName.trim()) {
    return template
      .replace(/\{\{name\}\}/g, firstName.trim())
      .replace(/\{\{nameComma\}\}/g, `, ${firstName.trim()}`);
  }
  // Strip placeholders cleanly when no name available.
  return template
    .replace(/\{\{name\}\}/g, 'there')
    .replace(/\{\{nameComma\}\}/g, '');
}

export function pickFallback(
  trigger: CoachTriggerType,
  firstName: string | null,
): string {
  const pool = POOLS[trigger];
  const raw = pool[Math.floor(Math.random() * pool.length)];
  return fillName(raw, firstName);
}

// ─── Message hygiene ─────────────────────────────────────────────────────

/**
 * Apply hard guardrails to anything Claude returns. Trim whitespace, strip
 * surrounding quotes if it tried to quote itself, enforce the 200-char cap
 * by truncating at a sentence boundary if possible.
 */
export function sanitizeMessage(raw: string): string {
  let m = raw.trim();
  // Strip wrapping quotes (single, double, smart)
  m = m.replace(/^["'“‘]+/, '').replace(/["'”’]+$/, '');
  // Collapse double spaces that sometimes sneak in
  m = m.replace(/\s+/g, ' ').trim();
  if (m.length <= 200) return m;

  // Hard cap: cut at the last sentence end within 200 chars; else hard slice + ellipsis
  const slice = m.slice(0, 200);
  const lastStop = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
  if (lastStop > 80) {
    return slice.slice(0, lastStop + 1).trim();
  }
  return slice.slice(0, 197).trim() + '...';
}

/**
 * Truncate to push-notification length. The spec asks for ~80 chars.
 * Cut at the last word boundary to avoid mid-word slicing.
 */
export function toPushBody(message: string, max = 80): string {
  if (message.length <= max) return message;
  const slice = message.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > 40 ? slice.slice(0, lastSpace) : slice).trim() + '…';
}
