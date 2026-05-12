import type { ActivityLevel, WalkBaseline, RunReadiness } from '../store/coachSetupStore';
import type { FeedbackRating } from '../types/session';

export interface PlacementResult {
  level: number;
  reason: string;
}

// Translate self-reported fitness inputs into a starting level (1–6).
//
// The walk baseline carries most of the signal — it's a concrete, observable
// capacity measurement, less ambiguous than activityLevel which mixes habit
// and intensity. activityLevel is a small modifier; runReadiness is what
// distinguishes "comfortable walker" from "ready to do intervals."
//
// We deliberately cap onboarding-derived placement at L6 (out of 16). Going
// higher requires real-session evidence, which post-session feedback can
// then provide via calibrateFromFirstSession.
export function computeStartingLevel(
  activity: ActivityLevel | null,
  walk: WalkBaseline | null,
  run: RunReadiness | null,
): PlacementResult {
  // Defensive defaults — if we somehow reach this with missing data, place
  // conservatively at L1 rather than guessing.
  if (!walk) return { level: 1, reason: 'Starting fresh — daily habit first' };

  let score = 0;

  // Walk baseline — dominant factor (concrete capacity).
  switch (walk) {
    case 'under_5':
      score += 0;
      break;
    case 'five_to_15':
      score += 1;
      break;
    case 'fifteen_to_30':
      score += 3;
      break;
    case 'thirty_plus':
      score += 4;
      break;
  }

  // Activity level — small modifier for habit intensity.
  switch (activity) {
    case 'no_exercise_years':
      score += -1;
      break;
    case 'occasionally_walk':
      score += 0;
      break;
    case 'somewhat_active':
      score += 0;
      break;
    case 'active_want_run':
      score += 1;
      break;
    default:
      break;
  }

  // Run readiness — boosts placement into running-focused levels.
  switch (run) {
    case 'no_never_tried':
      score += 0;
      break;
    case 'maybe_with_effort':
      score += 1;
      break;
    case 'yes_easily':
      score += 2;
      break;
    default:
      break;
  }

  let level = Math.max(1, Math.min(6, Math.round(score)));

  // Safety cap: if user explicitly said they've never jogged, keep them at
  // walk-jog intro levels regardless of how much they walk. The point is
  // they shouldn't be dropped into sustained-running plans without ever
  // having tried it.
  if (run === 'no_never_tried' && level > 4) level = 4;

  // If runReadiness wasn't asked (walkBaseline < 15 min), the upper bound
  // is naturally lower from the score alone, but cap explicitly for safety.
  if (!run && level > 3) level = 3;

  return { level, reason: levelReason(level) };
}

function levelReason(level: number): string {
  switch (level) {
    case 1:
      return 'Starting fresh — building the daily habit first';
    case 2:
      return 'Some walking experience — varying your pace';
    case 3:
      return 'Comfortable walker — adding short jogs';
    case 4:
      return 'Active walker — building run intervals';
    case 5:
      return 'Confident — sustained running';
    case 6:
      return 'Strong baseline — straight to running';
    default:
      return '';
  }
}

// One-time post-first-session adjustment. Returns the new level (clamped to
// 1–16) along with a delta if the level changed. The caller should only
// invoke this on the user's FIRST completed session — subsequent sessions
// use the standard time-based progression.
export interface CalibrationResult {
  previousLevel: number;
  newLevel: number;
  delta: number;
  reason: string;
}

export function calibrateFromFirstSession(
  currentLevel: number,
  feedback: FeedbackRating | null,
): CalibrationResult {
  let delta = 0;
  let reason = '';

  switch (feedback) {
    case 'too_easy':
      delta = 2;
      reason = 'Too easy on session 1 — bumping you up so the plan matches your fitness.';
      break;
    case 'challenging':
      delta = 1;
      reason = 'You handled a challenging session — moving you up a level.';
      break;
    case 'too_hard':
      delta = -1;
      reason = 'Session felt too hard — easing back so we build up sustainably.';
      break;
    case 'just_right':
    default:
      delta = 0;
      reason = '';
      break;
  }

  const newLevel = Math.max(1, Math.min(16, currentLevel + delta));
  const actualDelta = newLevel - currentLevel;

  return {
    previousLevel: currentLevel,
    newLevel,
    delta: actualDelta,
    reason: actualDelta === 0 ? '' : reason,
  };
}
