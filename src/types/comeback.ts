export type ComebackStatus =
  | 'no_gap'        // < 7 days, no intervention needed
  | 'moderate_gap'  // 7-30 days
  | 'extended_gap'; // 30+ days

export type ComebackChoice =
  | 'fitness_check'  // Self-assessment of current fitness
  | 'chat_about_it'  // Discuss with coach
  | 'been_active'    // Was active elsewhere (gym, cycling, etc.)
  | 'fresh_start'    // Want to restart
  | 'quick_decision'; // Just tell me where to start

export type FitnessFeeling =
  | 'too_easy'     // Could do much more
  | 'comfortable'  // Feels about right
  | 'challenging'  // Would have to push
  | 'too_hard';    // Would really struggle

export interface ComebackContext {
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

export interface ComebackDecision {
  recommendedLevel: number;
  reasoning: string;
  encouragement: string;
  suggestFitnessCheck: boolean;
}

export interface GapAnalysis {
  daysSinceLastSession: number | null;
  status: ComebackStatus;
  previousLevel: number;
}
