// ============================================
// SEGMENT TYPES
// ============================================

export type SegmentType = 'warmup' | 'walk' | 'run' | 'cooldown';

export interface SessionSegment {
  id: string;
  type: SegmentType;
  durationSeconds: number;
  label: string;       // "Easy pace", "Comfortable jog", "Recovery"
  order: number;       // Position in the session
}

// ============================================
// SESSION PLAN TYPES
// ============================================

export type SessionDifficulty = 'easy' | 'moderate' | 'challenging' | 'hard';
export type SessionVariant = 'recommended' | 'quick' | 'challenge' | 'push';

export interface SessionPlan {
  id: string;
  level: number;                  // 1-16
  variant: SessionVariant;
  title: string;                  // "20-min Walk/Run"
  subtitle: string;               // "Level 4 · Moderate"
  description: string;
  totalDurationMinutes: number;
  difficulty: SessionDifficulty;
  segments: SessionSegment[];
  isRecommended: boolean;
  summary: string;                // "3 min warmup → 5×(1.5 min run + 2 min walk) → 2 min cooldown"
}

export interface SessionOptions {
  recommended: SessionPlan;
  alternatives: SessionPlan[];    // Quick, Challenge, Push options
  coachMessage: string;           // AI-generated contextual message
  generatedAt: string;            // ISO timestamp
}

// ============================================
// ACTIVE SESSION TYPES
// ============================================

export interface GeoPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy?: number;
}

export interface ActiveSession {
  plan: SessionPlan;
  startedAt: Date;
  currentSegmentIndex: number;
  segmentElapsedSeconds: number;  // Time in current segment
  totalElapsedSeconds: number;    // Total session time
  isPaused: boolean;
  pausedAt: Date | null;
  route: GeoPoint[];
  distanceKm: number;
}

// ============================================
// COMPLETED SESSION TYPES
// ============================================

export type FeedbackRating = 'too_easy' | 'just_right' | 'challenging' | 'too_hard';

export interface CompletedSession {
  id: string;
  orderId: string;

  // Plan info
  planId: string;
  planLevel: number;
  planVariant: SessionVariant;
  planTitle: string;
  plannedDurationMinutes: number;
  plannedSegments: SessionSegment[];

  // Actual performance
  actualDurationMinutes: number;
  actualDistanceKm: number;
  completedSegments: number;      // How many segments they finished
  endedEarly: boolean;
  pacePerKm: number | null;       // Minutes per km

  // GPS data
  route: GeoPoint[];

  // Feedback
  feedbackRating: FeedbackRating | null;
  feedbackNotes: string | null;

  // Timestamps
  startedAt: string;
  completedAt: string;
}

// ============================================
// USER PROGRESS TYPES
// ============================================

export interface UserProgress {
  userId: string;
  currentLevel: number;           // 1-16
  sessionsAtCurrentLevel: number; // Sessions completed at this level
  totalSessionsCompleted: number;
  totalDistanceKm: number;
  totalDurationMinutes: number;
  longestRunMinutes: number;      // Longest continuous run
  currentStreakDays: number;
  bestStreakDays: number;
  lastSessionDate: string | null; // ISO date string

  // This week
  sessionsThisWeek: number;
  minutesThisWeek: number;
  weekStartDate: string;          // Monday of current week
}

// ============================================
// SESSION HISTORY RECORD
// ============================================

export interface SessionRecord {
  id: string;
  date: string;              // YYYY-MM-DD
  durationMinutes: number;
  distanceKm: number;
  planTitle: string;
  planLevel: number;
}

// ============================================
// LEVEL DEFINITION TYPES
// ============================================

export interface LevelDefinition {
  level: number;
  week: number;               // Which week of the program
  name: string;               // "First Steps", "Finding Stride", etc.
  focus: string;              // What this level is building
  description: string;
  unlockCriteria: string;

  // Session templates for this level
  recommendedTemplate: SessionTemplate;
  quickTemplate: SessionTemplate;
  challengeTemplate: SessionTemplate;
  pushTemplate: SessionTemplate;
}

export interface SessionTemplate {
  variant: SessionVariant;
  title: string;
  totalDurationMinutes: number;
  difficulty: SessionDifficulty;
  description: string;
  summary: string;
  segments: Omit<SessionSegment, 'id'>[];  // IDs generated at runtime
}
