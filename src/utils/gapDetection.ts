import { ComebackStatus, GapAnalysis } from '../types/comeback';
import { UserProgress } from '../types/session';

/**
 * Analyzes the gap since the user's last session.
 * Returns status and days since last session.
 */
export const analyzeGap = (progress: UserProgress | null): GapAnalysis => {
  if (!progress || !progress.lastSessionDate) {
    return {
      daysSinceLastSession: null,
      status: 'no_gap',
      previousLevel: progress?.currentLevel ?? 1,
    };
  }

  const lastSession = new Date(progress.lastSessionDate);
  const today = new Date();

  lastSession.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - lastSession.getTime();
  const daysSinceLastSession = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  let status: ComebackStatus;

  if (daysSinceLastSession < 7) {
    status = 'no_gap';
  } else if (daysSinceLastSession < 31) {
    status = 'moderate_gap';
  } else {
    status = 'extended_gap';
  }

  return {
    daysSinceLastSession,
    status,
    previousLevel: progress.currentLevel,
  };
};

/**
 * Formats the gap duration in a friendly, human-readable way.
 */
export const formatGapDuration = (days: number): string => {
  if (days < 7) {
    return `${days} days`;
  } else if (days < 14) {
    return 'about a week';
  } else if (days < 21) {
    return 'about 2 weeks';
  } else if (days < 35) {
    return 'about a month';
  } else if (days < 60) {
    return `${Math.round(days / 7)} weeks`;
  } else {
    return `${Math.round(days / 30)} months`;
  }
};
