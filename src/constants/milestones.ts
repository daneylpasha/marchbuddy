import type { UserProgress } from '../types/session';

export type MilestoneType =
  | 'first_session'
  | 'sessions_10'
  | 'sessions_25'
  | 'sessions_50'
  | 'sessions_100'
  | 'streak_7'
  | 'streak_14'
  | 'streak_30'
  | 'streak_60'
  | 'level_up'
  | 'distance_5km'
  | 'distance_25km'
  | 'distance_50km'
  | 'distance_100km'
  | 'program_complete';

export interface MilestoneConfig {
  type: MilestoneType;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  iconColor: string;
  backgroundColor: string;
  confettiColors?: string[];
  shareText: string;
}

export const MILESTONE_CONFIGS: Record<string, MilestoneConfig> = {
  first_session: {
    type: 'first_session',
    title: 'First Step Taken',
    subtitle: 'Session 1 Complete',
    description: 'Every journey begins with a single step. You just took yours.',
    icon: 'footsteps',
    iconColor: '#4CAF50',
    backgroundColor: 'rgba(76,175,80,0.12)',
    confettiColors: ['#4CAF50', '#81C784', '#A5D6A7'],
    shareText: 'I just completed my first session with MarchBuddy! The journey to 5K begins 🏃',
  },
  sessions_10: {
    type: 'sessions_10',
    title: 'Double Digits',
    subtitle: '10 Sessions Complete',
    description: "You're not just trying anymore. You're doing this.",
    icon: 'fitness',
    iconColor: '#2196F3',
    backgroundColor: 'rgba(33,150,243,0.12)',
    confettiColors: ['#2196F3', '#64B5F6', '#90CAF9'],
    shareText: 'Just hit 10 sessions on MarchBuddy! Building momentum 💪',
  },
  sessions_25: {
    type: 'sessions_25',
    title: 'Quarter Century',
    subtitle: '25 Sessions Complete',
    description: 'Twenty-five sessions in. This is becoming who you are.',
    icon: 'star',
    iconColor: '#9C27B0',
    backgroundColor: 'rgba(156,39,176,0.12)',
    confettiColors: ['#9C27B0', '#CE93D8', '#E1BEE7'],
    shareText: '25 sessions complete! MarchBuddy is making me a runner 🌟',
  },
  sessions_50: {
    type: 'sessions_50',
    title: 'Fifty Strong',
    subtitle: '50 Sessions Complete',
    description: "Half a hundred sessions. You're not the same person who started.",
    icon: 'trophy',
    iconColor: '#FF9800',
    backgroundColor: 'rgba(255,152,0,0.12)',
    confettiColors: ['#FF9800', '#FFB74D', '#FFCC02'],
    shareText: '50 sessions with MarchBuddy! Half a hundred and counting 🏆',
  },
  sessions_100: {
    type: 'sessions_100',
    title: 'Centurion',
    subtitle: '100 Sessions Complete',
    description: 'One hundred sessions. You are officially relentless.',
    icon: 'medal',
    iconColor: '#F44336',
    backgroundColor: 'rgba(244,67,54,0.12)',
    confettiColors: ['#F44336', '#FF9800', '#FFEB3B', '#4CAF50', '#2196F3'],
    shareText: '100 SESSIONS! I am a MarchBuddy centurion! 🎖️',
  },
  streak_7: {
    type: 'streak_7',
    title: 'Week Warrior',
    subtitle: '7-Day Streak',
    description: 'A full week of consistency. Habits are forming.',
    icon: 'flame',
    iconColor: '#FF5722',
    backgroundColor: 'rgba(255,87,34,0.12)',
    confettiColors: ['#FF5722', '#FF7043', '#FF9800'],
    shareText: '7-day streak on MarchBuddy! 🔥 One week strong!',
  },
  streak_14: {
    type: 'streak_14',
    title: 'Fortnight Fighter',
    subtitle: '14-Day Streak',
    description: 'Two weeks straight. This is becoming automatic.',
    icon: 'flame',
    iconColor: '#FF5722',
    backgroundColor: 'rgba(255,87,34,0.12)',
    confettiColors: ['#FF5722', '#FF7043', '#FF9800'],
    shareText: 'Two weeks straight! 14-day streak on MarchBuddy! 🔥🔥',
  },
  streak_30: {
    type: 'streak_30',
    title: 'Monthly Master',
    subtitle: '30-Day Streak',
    description: 'A full month without missing a day. Unstoppable.',
    icon: 'flame',
    iconColor: '#FF5722',
    backgroundColor: 'rgba(255,87,34,0.12)',
    confettiColors: ['#FF5722', '#FF9800', '#FFEB3B'],
    shareText: '30-DAY STREAK! One month of consistency with MarchBuddy! 🔥🔥🔥',
  },
  streak_60: {
    type: 'streak_60',
    title: 'Legendary',
    subtitle: '60-Day Streak',
    description: 'Sixty days. Two months. This is who you are now.',
    icon: 'flame',
    iconColor: '#FF5722',
    backgroundColor: 'rgba(255,87,34,0.12)',
    confettiColors: ['#FF5722', '#FF9800', '#FFEB3B', '#F44336'],
    shareText: '60-DAY STREAK! I am UNSTOPPABLE! 🔥🔥🔥🔥',
  },
  level_up: {
    type: 'level_up',
    title: 'Level Up!',
    subtitle: 'Level {level} Unlocked',
    description: "You've proven yourself. New challenges await.",
    icon: 'arrow-up-circle',
    iconColor: '#00BCD4',
    backgroundColor: 'rgba(0,188,212,0.12)',
    confettiColors: ['#00BCD4', '#4DD0E1', '#068a15', '#0BA820'],
    shareText: 'Just unlocked Level {level} on MarchBuddy! Moving up! 📈',
  },
  distance_5km: {
    type: 'distance_5km',
    title: 'First 5K',
    subtitle: '5km Total Distance',
    description: 'Your first 5 kilometers logged. Many more to come.',
    icon: 'navigate',
    iconColor: '#009688',
    backgroundColor: 'rgba(0,150,136,0.12)',
    confettiColors: ['#009688', '#4CAF50', '#00BCD4'],
    shareText: 'Just passed 5km total on MarchBuddy! 🗺️',
  },
  distance_25km: {
    type: 'distance_25km',
    title: 'Quarter Marathon',
    subtitle: '25km Total Distance',
    description: "Twenty-five kilometers. That's serious ground covered.",
    icon: 'navigate',
    iconColor: '#009688',
    backgroundColor: 'rgba(0,150,136,0.12)',
    confettiColors: ['#009688', '#4CAF50', '#00BCD4'],
    shareText: '25km total distance! A quarter marathon worth! 🗺️',
  },
  distance_50km: {
    type: 'distance_50km',
    title: 'Fifty K',
    subtitle: '50km Total Distance',
    description: "Fifty kilometers. That's an ultramarathon distance.",
    icon: 'navigate',
    iconColor: '#009688',
    backgroundColor: 'rgba(0,150,136,0.12)',
    confettiColors: ['#009688', '#4CAF50', '#00BCD4'],
    shareText: '50km logged on MarchBuddy! Ultramarathon territory! 🗺️🏃',
  },
  distance_100km: {
    type: 'distance_100km',
    title: 'Century Distance',
    subtitle: '100km Total Distance',
    description: "One hundred kilometers. You've run a serious distance.",
    icon: 'navigate',
    iconColor: '#009688',
    backgroundColor: 'rgba(0,150,136,0.12)',
    confettiColors: ['#009688', '#4CAF50', '#00BCD4', '#FFEB3B'],
    shareText: '100 KILOMETERS! Triple digit distance on MarchBuddy! 🗺️🏃💯',
  },
  program_complete: {
    type: 'program_complete',
    title: '5K RUNNER',
    subtitle: 'Program Complete',
    description: 'You did it. From couch to 5K. You are officially a runner.',
    icon: 'trophy',
    iconColor: '#FFD700',
    backgroundColor: 'rgba(255,215,0,0.12)',
    confettiColors: ['#FFD700', '#FFC107', '#FF9800', '#4CAF50', '#2196F3', '#9C27B0'],
    shareText: 'I AM A 5K RUNNER! Completed the MarchBuddy couch-to-5K program! 🏆🎉🏃',
  },
};

export const getMilestoneConfig = (milestoneId: string): MilestoneConfig | null => {
  if (milestoneId.startsWith('level_') && milestoneId !== 'level_up') {
    const levelNum = parseInt(milestoneId.split('_')[1], 10);
    if (levelNum === 16) return MILESTONE_CONFIGS.program_complete;
    const config = { ...MILESTONE_CONFIGS.level_up };
    config.subtitle = config.subtitle.replace('{level}', levelNum.toString());
    config.shareText = config.shareText.replace('{level}', levelNum.toString());
    return config;
  }
  return MILESTONE_CONFIGS[milestoneId] ?? null;
};

/**
 * Detects which milestone (if any) was reached this session.
 * Call after all store updates (updateAfterSession, incrementLevel) are applied.
 *
 * @param prevDistanceKm - totalDistanceKm BEFORE this session was added
 * @param freshProgress - store state AFTER updateAfterSession but BEFORE incrementLevel
 * @param leveledUp - whether incrementLevel was called
 * @param newLevel - currentLevel after potential incrementLevel
 */
export const detectMilestone = (
  prevDistanceKm: number,
  freshProgress: UserProgress,
  leveledUp: boolean,
  newLevel: number,
): string | null => {
  const { totalSessionsCompleted, currentStreakDays, totalDistanceKm } = freshProgress;

  // Program complete (level 16 reached this session)
  if (leveledUp && newLevel === 16) return 'program_complete';

  // Any level-up
  if (leveledUp) return `level_${newLevel}`;

  // First session ever
  if (totalSessionsCompleted === 1) return 'first_session';

  // Session count milestones (exact hits)
  if (totalSessionsCompleted === 10) return 'sessions_10';
  if (totalSessionsCompleted === 25) return 'sessions_25';
  if (totalSessionsCompleted === 50) return 'sessions_50';
  if (totalSessionsCompleted === 100) return 'sessions_100';

  // Streak milestones (exact day counts hit this session)
  if (currentStreakDays === 7) return 'streak_7';
  if (currentStreakDays === 14) return 'streak_14';
  if (currentStreakDays === 30) return 'streak_30';
  if (currentStreakDays === 60) return 'streak_60';

  // Distance milestones (threshold crossed this session)
  const distanceThresholds: Array<{ km: number; id: string }> = [
    { km: 5, id: 'distance_5km' },
    { km: 25, id: 'distance_25km' },
    { km: 50, id: 'distance_50km' },
    { km: 100, id: 'distance_100km' },
  ];
  for (const { km, id } of distanceThresholds) {
    if (prevDistanceKm < km && totalDistanceKm >= km) return id;
  }

  return null;
};
