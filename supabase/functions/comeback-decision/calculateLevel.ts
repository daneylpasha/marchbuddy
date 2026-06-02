// Deterministic comeback-level math. Lives outside the AI prompt so the
// level decision is predictable, testable, and impossible for Claude to
// drift on (the prior LLM-driven version sometimes recommended Level 1
// after a 7-day gap from Level 4, violating its own rules).

export type FitnessFeeling = 'too_easy' | 'comfortable' | 'challenging' | 'too_hard';

export interface CalcInput {
  previousLevel: number;
  daysSinceLastSession: number;
  fitnessFeeling?: FitnessFeeling;
}

export interface CalcResult {
  recommendedLevel: number;
  levelDrop: number;
  baseDrop: number;
  feelingModifier: number;
}

// Base level-drop driven purely by how long the user has been away.
// 7-14 days = 1 level of regression, scaling up as the gap grows.
function baseDropForGap(days: number): number {
  if (days < 7) return 0;
  if (days <= 14) return 1;
  if (days <= 21) return 2;
  if (days <= 30) return 3;
  if (days <= 60) return 4;
  return 5;
}

// Self-assessment can only INCREASE the gap-based drop, never reduce it.
// The reasoning: detraining after a 7+ day break is biological, not a
// matter of confidence — even a user who feels strong should ease back
// in by at least the baseline. Self-assessment is for catching users who
// feel weaker than the baseline assumes.
//
// `too_easy`   → baseline only (user is confident, no extra drop)
// `comfortable`→ baseline only
// `challenging`→ one extra level off (they're signalling more caution)
// `too_hard`   → two extra levels off (safety-first)
function feelingModifier(feeling?: FitnessFeeling): number {
  switch (feeling) {
    case 'challenging':
      return 1;
    case 'too_hard':
      return 2;
    case 'too_easy':
    case 'comfortable':
    default:
      return 0;
  }
}

export function calculateLevel(input: CalcInput): CalcResult {
  const previousLevel = Math.max(1, Math.min(16, Math.round(input.previousLevel)));
  const days = Math.max(0, Math.round(input.daysSinceLastSession));
  const base = baseDropForGap(days);
  const mod = feelingModifier(input.fitnessFeeling);
  const levelDrop = Math.max(0, base + mod);
  const recommendedLevel = Math.max(1, Math.min(16, previousLevel - levelDrop));
  return { recommendedLevel, levelDrop, baseDrop: base, feelingModifier: mod };
}
