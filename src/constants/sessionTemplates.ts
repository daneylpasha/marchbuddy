import {
  LevelDefinition,
  SessionPlan,
  SessionSegment,
  SessionTemplate,
  SegmentType,
} from '../types/session';

// ============================================
// HELPERS
// ============================================

interface SegmentInput {
  type: SegmentType;
  minutes: number;
  seconds?: number;
  label: string;
}

const createSegments = (inputs: SegmentInput[]): Omit<SessionSegment, 'id'>[] =>
  inputs.map((input, index) => ({
    type: input.type,
    durationSeconds: input.minutes * 60 + (input.seconds ?? 0),
    label: input.label,
    order: index,
  }));

const repeatIntervals = (
  runMinutes: number,
  walkMinutes: number,
  count: number,
  runLabel = 'Comfortable jog',
  walkLabel = 'Recovery walk',
): SegmentInput[] => {
  const intervals: SegmentInput[] = [];
  for (let i = 0; i < count; i++) {
    intervals.push({ type: 'run', minutes: runMinutes, label: runLabel });
    intervals.push({ type: 'walk', minutes: walkMinutes, label: walkLabel });
  }
  return intervals;
};

// ============================================
// LEVEL DEFINITIONS
// ============================================

export const LEVEL_DEFINITIONS: LevelDefinition[] = [
  // ──────────────────────────────────────────
  // WEEKS 1-2: FOUNDATION (Walking Only)
  // ──────────────────────────────────────────
  {
    level: 1,
    week: 1,
    name: 'First Steps',
    focus: 'Build the daily habit',
    description: 'This week is about one thing: getting outside. No pace, no pressure. Just walk.',
    unlockCriteria: 'Starting your journey',

    recommendedTemplate: {
      variant: 'recommended',
      title: '10-min Easy Walk',
      totalDurationMinutes: 10,
      difficulty: 'easy',
      description: 'A simple walk to start building the habit.',
      summary: '10 minutes easy walking',
      segments: createSegments([
        { type: 'warmup', minutes: 2, label: 'Easy pace' },
        { type: 'walk', minutes: 6, label: 'Comfortable walk' },
        { type: 'cooldown', minutes: 2, label: 'Easy pace' },
      ]),
    },

    quickTemplate: {
      variant: 'quick',
      title: '8-min Quick Walk',
      totalDurationMinutes: 8,
      difficulty: 'easy',
      description: 'Short on time? This still counts.',
      summary: '8 minutes easy walking',
      segments: createSegments([
        { type: 'warmup', minutes: 2, label: 'Easy pace' },
        { type: 'walk', minutes: 4, label: 'Comfortable walk' },
        { type: 'cooldown', minutes: 2, label: 'Easy pace' },
      ]),
    },

    challengeTemplate: {
      variant: 'challenge',
      title: '15-min Walk',
      totalDurationMinutes: 15,
      difficulty: 'easy',
      description: 'Feeling good? Extend the walk.',
      summary: '15 minutes easy walking',
      segments: createSegments([
        { type: 'warmup', minutes: 3, label: 'Easy pace' },
        { type: 'walk', minutes: 9, label: 'Comfortable walk' },
        { type: 'cooldown', minutes: 3, label: 'Easy pace' },
      ]),
    },

    pushTemplate: {
      variant: 'push',
      title: '20-min Extended Walk',
      totalDurationMinutes: 20,
      difficulty: 'moderate',
      description: "Full of energy? Let's use it.",
      summary: '20 minutes with brisk intervals',
      segments: createSegments([
        { type: 'warmup', minutes: 3, label: 'Easy pace' },
        { type: 'walk', minutes: 5, label: 'Comfortable walk' },
        { type: 'walk', minutes: 4, label: 'Brisk pace' },
        { type: 'walk', minutes: 5, label: 'Comfortable walk' },
        { type: 'cooldown', minutes: 3, label: 'Easy pace' },
      ]),
    },
  },

  {
    level: 2,
    week: 1,
    name: 'Building Rhythm',
    focus: 'Introduce pace variation',
    description: 'Now we add some brisk walking intervals. You control the pace.',
    unlockCriteria: '3 sessions completed at Level 1',

    recommendedTemplate: {
      variant: 'recommended',
      title: '15-min Walk with Pace',
      totalDurationMinutes: 15,
      difficulty: 'easy',
      description: 'Walking with brisk intervals to build cardio.',
      summary: '3 min warmup → brisk intervals → 2 min cooldown',
      segments: createSegments([
        { type: 'warmup', minutes: 3, label: 'Easy pace' },
        { type: 'walk', minutes: 2, label: 'Brisk walk' },
        { type: 'walk', minutes: 2, label: 'Easy pace' },
        { type: 'walk', minutes: 2, label: 'Brisk walk' },
        { type: 'walk', minutes: 2, label: 'Easy pace' },
        { type: 'walk', minutes: 2, label: 'Brisk walk' },
        { type: 'cooldown', minutes: 2, label: 'Easy pace' },
      ]),
    },

    quickTemplate: {
      variant: 'quick',
      title: '12-min Quick Walk',
      totalDurationMinutes: 12,
      difficulty: 'easy',
      description: 'Shorter version with pace changes.',
      summary: '12 minutes with brisk intervals',
      segments: createSegments([
        { type: 'warmup', minutes: 2, label: 'Easy pace' },
        { type: 'walk', minutes: 2, label: 'Brisk walk' },
        { type: 'walk', minutes: 2, label: 'Easy pace' },
        { type: 'walk', minutes: 2, label: 'Brisk walk' },
        { type: 'walk', minutes: 2, label: 'Easy pace' },
        { type: 'cooldown', minutes: 2, label: 'Easy pace' },
      ]),
    },

    challengeTemplate: {
      variant: 'challenge',
      title: '20-min Brisk Walk',
      totalDurationMinutes: 20,
      difficulty: 'moderate',
      description: 'More time, more intervals.',
      summary: '20 minutes with extended brisk intervals',
      segments: createSegments([
        { type: 'warmup', minutes: 3, label: 'Easy pace' },
        { type: 'walk', minutes: 3, label: 'Brisk walk' },
        { type: 'walk', minutes: 2, label: 'Easy pace' },
        { type: 'walk', minutes: 3, label: 'Brisk walk' },
        { type: 'walk', minutes: 2, label: 'Easy pace' },
        { type: 'walk', minutes: 3, label: 'Brisk walk' },
        { type: 'walk', minutes: 2, label: 'Easy pace' },
        { type: 'cooldown', minutes: 2, label: 'Easy pace' },
      ]),
    },

    pushTemplate: {
      variant: 'push',
      title: '25-min Power Walk',
      totalDurationMinutes: 25,
      difficulty: 'moderate',
      description: 'Extended session for high energy days.',
      summary: '25 minutes power walking',
      segments: createSegments([
        { type: 'warmup', minutes: 3, label: 'Easy pace' },
        { type: 'walk', minutes: 4, label: 'Brisk walk' },
        { type: 'walk', minutes: 2, label: 'Easy pace' },
        { type: 'walk', minutes: 4, label: 'Brisk walk' },
        { type: 'walk', minutes: 2, label: 'Easy pace' },
        { type: 'walk', minutes: 4, label: 'Brisk walk' },
        { type: 'walk', minutes: 2, label: 'Easy pace' },
        { type: 'cooldown', minutes: 4, label: 'Easy pace' },
      ]),
    },
  },

  // ──────────────────────────────────────────
  // WEEKS 3-4: INTRODUCTION TO RUNNING
  // ──────────────────────────────────────────
  {
    level: 3,
    week: 2,
    name: 'First Jogs',
    focus: 'Introduce short running intervals',
    description: 'Time to jog! Short 1-minute intervals with plenty of recovery.',
    unlockCriteria: '3 sessions at Level 2',

    recommendedTemplate: {
      variant: 'recommended',
      title: '18-min Walk/Jog',
      totalDurationMinutes: 18,
      difficulty: 'moderate',
      description: 'Your first running intervals. Short jogs, full recovery.',
      summary: '3 min warmup → 4×(1 min jog + 2 min walk) → 3 min cooldown',
      segments: createSegments([
        { type: 'warmup', minutes: 3, label: 'Easy walk' },
        ...repeatIntervals(1, 2, 4, 'Easy jog', 'Recovery walk'),
        { type: 'cooldown', minutes: 3, label: 'Easy walk' },
      ]),
    },

    quickTemplate: {
      variant: 'quick',
      title: '14-min Quick Jog',
      totalDurationMinutes: 14,
      difficulty: 'moderate',
      description: 'Fewer intervals for shorter time.',
      summary: '3×(1 min jog + 2 min walk)',
      segments: createSegments([
        { type: 'warmup', minutes: 2, label: 'Easy walk' },
        ...repeatIntervals(1, 2, 3, 'Easy jog', 'Recovery walk'),
        { type: 'cooldown', minutes: 3, label: 'Easy walk' },
      ]),
    },

    challengeTemplate: {
      variant: 'challenge',
      title: '22-min Extended Jog',
      totalDurationMinutes: 22,
      difficulty: 'moderate',
      description: 'More intervals to build endurance.',
      summary: '5×(1 min jog + 2 min walk)',
      segments: createSegments([
        { type: 'warmup', minutes: 3, label: 'Easy walk' },
        ...repeatIntervals(1, 2, 5, 'Easy jog', 'Recovery walk'),
        { type: 'cooldown', minutes: 4, label: 'Easy walk' },
      ]),
    },

    pushTemplate: {
      variant: 'push',
      title: '28-min Full Session',
      totalDurationMinutes: 28,
      difficulty: 'challenging',
      description: 'Extended session with more running time.',
      summary: '6×(1.5 min jog + 2 min walk)',
      segments: createSegments([
        { type: 'warmup', minutes: 3, label: 'Easy walk' },
        ...repeatIntervals(1.5, 2, 6, 'Easy jog', 'Recovery walk'),
        { type: 'cooldown', minutes: 4, label: 'Easy walk' },
      ]),
    },
  },

  {
    level: 4,
    week: 2,
    name: 'Finding Stride',
    focus: 'Slightly longer running intervals',
    description: 'Building on your jog intervals. A bit longer, still manageable.',
    unlockCriteria: '3 sessions at Level 3',

    recommendedTemplate: {
      variant: 'recommended',
      title: '20-min Walk/Run',
      totalDurationMinutes: 20,
      difficulty: 'moderate',
      description: '90-second run intervals with full recovery.',
      summary: '3 min warmup → 5×(1.5 min run + 2 min walk) → 2 min cooldown',
      segments: createSegments([
        { type: 'warmup', minutes: 3, label: 'Easy walk' },
        ...repeatIntervals(1.5, 2, 5, 'Comfortable jog', 'Recovery walk'),
        { type: 'cooldown', minutes: 2, seconds: 30, label: 'Easy walk' },
      ]),
    },

    quickTemplate: {
      variant: 'quick',
      title: '16-min Quick Session',
      totalDurationMinutes: 16,
      difficulty: 'moderate',
      description: 'Shorter but effective.',
      summary: '4×(1.5 min run + 2 min walk)',
      segments: createSegments([
        { type: 'warmup', minutes: 2, label: 'Easy walk' },
        ...repeatIntervals(1.5, 2, 4, 'Comfortable jog', 'Recovery walk'),
        { type: 'cooldown', minutes: 2, label: 'Easy walk' },
      ]),
    },

    challengeTemplate: {
      variant: 'challenge',
      title: '25-min Challenge',
      totalDurationMinutes: 25,
      difficulty: 'challenging',
      description: 'More running, less walking.',
      summary: '6×(1.5 min run + 1.5 min walk)',
      segments: createSegments([
        { type: 'warmup', minutes: 3, label: 'Easy walk' },
        ...repeatIntervals(1.5, 1.5, 6, 'Comfortable jog', 'Recovery walk'),
        { type: 'cooldown', minutes: 4, label: 'Easy walk' },
      ]),
    },

    pushTemplate: {
      variant: 'push',
      title: '32-min Extended',
      totalDurationMinutes: 32,
      difficulty: 'challenging',
      description: 'Full session for high energy.',
      summary: '8×(2 min run + 2 min walk)',
      segments: createSegments([
        { type: 'warmup', minutes: 3, label: 'Easy walk' },
        ...repeatIntervals(2, 2, 8, 'Comfortable jog', 'Recovery walk'),
        { type: 'cooldown', minutes: 3, label: 'Easy walk' },
      ]),
    },
  },

  // ──────────────────────────────────────────
  // WEEKS 5-6: BUILDING RUN ENDURANCE
  // ──────────────────────────────────────────
  {
    level: 5,
    week: 3,
    name: 'Run Confidence',
    focus: '2-minute continuous runs',
    description: "Your runs are getting longer. Two minutes at a time.",
    unlockCriteria: '3 sessions at Level 4',

    recommendedTemplate: {
      variant: 'recommended',
      title: '22-min Run Builder',
      totalDurationMinutes: 22,
      difficulty: 'moderate',
      description: "2-minute run intervals. You've got this.",
      summary: '3 min warmup → 4×(2 min run + 2 min walk) → 3 min cooldown',
      segments: createSegments([
        { type: 'warmup', minutes: 3, label: 'Easy walk' },
        ...repeatIntervals(2, 2, 4, 'Steady run', 'Recovery walk'),
        { type: 'cooldown', minutes: 3, label: 'Easy walk' },
      ]),
    },

    quickTemplate: {
      variant: 'quick',
      title: '18-min Quick Run',
      totalDurationMinutes: 18,
      difficulty: 'moderate',
      description: 'Fewer intervals, same quality.',
      summary: '3×(2 min run + 2 min walk)',
      segments: createSegments([
        { type: 'warmup', minutes: 3, label: 'Easy walk' },
        ...repeatIntervals(2, 2, 3, 'Steady run', 'Recovery walk'),
        { type: 'cooldown', minutes: 3, label: 'Easy walk' },
      ]),
    },

    challengeTemplate: {
      variant: 'challenge',
      title: '28-min Run Challenge',
      totalDurationMinutes: 28,
      difficulty: 'challenging',
      description: 'More running time, shorter recovery.',
      summary: '5×(2.5 min run + 2 min walk)',
      segments: createSegments([
        { type: 'warmup', minutes: 3, label: 'Easy walk' },
        ...repeatIntervals(2.5, 2, 5, 'Steady run', 'Recovery walk'),
        { type: 'cooldown', minutes: 3, seconds: 30, label: 'Easy walk' },
      ]),
    },

    pushTemplate: {
      variant: 'push',
      title: '35-min Endurance',
      totalDurationMinutes: 35,
      difficulty: 'challenging',
      description: 'Extended endurance builder.',
      summary: '6×(3 min run + 2 min walk)',
      segments: createSegments([
        { type: 'warmup', minutes: 4, label: 'Easy walk' },
        ...repeatIntervals(3, 2, 6, 'Steady run', 'Recovery walk'),
        { type: 'cooldown', minutes: 4, label: 'Easy walk' },
      ]),
    },
  },

  {
    level: 6,
    week: 3,
    name: 'Extending Runs',
    focus: '3-minute continuous runs',
    description: "Three-minute runs. You're building real endurance now.",
    unlockCriteria: '3 sessions at Level 5',

    recommendedTemplate: {
      variant: 'recommended',
      title: '25-min Run Focus',
      totalDurationMinutes: 25,
      difficulty: 'moderate',
      description: '3-minute run blocks. This is where it starts to feel real.',
      summary: '3 min warmup → 4×(3 min run + 2 min walk) → 2 min cooldown',
      segments: createSegments([
        { type: 'warmup', minutes: 3, label: 'Easy walk' },
        ...repeatIntervals(3, 2, 4, 'Steady run', 'Recovery walk'),
        { type: 'cooldown', minutes: 2, label: 'Easy walk' },
      ]),
    },

    quickTemplate: {
      variant: 'quick',
      title: '20-min Quick Focus',
      totalDurationMinutes: 20,
      difficulty: 'moderate',
      description: 'Condensed but effective.',
      summary: '3×(3 min run + 2 min walk)',
      segments: createSegments([
        { type: 'warmup', minutes: 3, label: 'Easy walk' },
        ...repeatIntervals(3, 2, 3, 'Steady run', 'Recovery walk'),
        { type: 'cooldown', minutes: 2, label: 'Easy walk' },
      ]),
    },

    challengeTemplate: {
      variant: 'challenge',
      title: '32-min Challenge',
      totalDurationMinutes: 32,
      difficulty: 'challenging',
      description: 'More 3-minute blocks.',
      summary: '5×(3.5 min run + 2 min walk)',
      segments: createSegments([
        { type: 'warmup', minutes: 3, label: 'Easy walk' },
        ...repeatIntervals(3.5, 2, 5, 'Steady run', 'Recovery walk'),
        { type: 'cooldown', minutes: 3, seconds: 30, label: 'Easy walk' },
      ]),
    },

    pushTemplate: {
      variant: 'push',
      title: '40-min Extended',
      totalDurationMinutes: 40,
      difficulty: 'challenging',
      description: 'Full endurance session.',
      summary: '6×(4 min run + 2 min walk)',
      segments: createSegments([
        { type: 'warmup', minutes: 4, label: 'Easy walk' },
        ...repeatIntervals(4, 2, 6, 'Steady run', 'Recovery walk'),
        { type: 'cooldown', minutes: 4, label: 'Easy walk' },
      ]),
    },
  },

  // ──────────────────────────────────────────
  // WEEKS 7-8: RUN DOMINANCE
  // ──────────────────────────────────────────
  {
    level: 7,
    week: 4,
    name: 'More Running',
    focus: '5-minute continuous runs',
    description: "Five-minute runs. Your endurance is really building.",
    unlockCriteria: '3 sessions at Level 6',

    recommendedTemplate: {
      variant: 'recommended',
      title: '28-min Run Strong',
      totalDurationMinutes: 28,
      difficulty: 'challenging',
      description: "5-minute run blocks. You're a runner now.",
      summary: '3 min warmup → 3×(5 min run + 2 min walk) → 4 min cooldown',
      segments: createSegments([
        { type: 'warmup', minutes: 3, label: 'Easy walk' },
        ...repeatIntervals(5, 2, 3, 'Steady run', 'Recovery walk'),
        { type: 'cooldown', minutes: 4, label: 'Easy walk' },
      ]),
    },

    quickTemplate: {
      variant: 'quick',
      title: '22-min Quick Strong',
      totalDurationMinutes: 22,
      difficulty: 'moderate',
      description: 'Two solid 5-minute runs.',
      summary: '2×(5 min run + 3 min walk)',
      segments: createSegments([
        { type: 'warmup', minutes: 3, label: 'Easy walk' },
        ...repeatIntervals(5, 3, 2, 'Steady run', 'Recovery walk'),
        { type: 'cooldown', minutes: 3, label: 'Easy walk' },
      ]),
    },

    challengeTemplate: {
      variant: 'challenge',
      title: '35-min Challenge',
      totalDurationMinutes: 35,
      difficulty: 'challenging',
      description: 'Four 5-minute blocks.',
      summary: '4×(5 min run + 2 min walk)',
      segments: createSegments([
        { type: 'warmup', minutes: 3, label: 'Easy walk' },
        ...repeatIntervals(5, 2, 4, 'Steady run', 'Recovery walk'),
        { type: 'cooldown', minutes: 4, label: 'Easy walk' },
      ]),
    },

    pushTemplate: {
      variant: 'push',
      title: '45-min Endurance',
      totalDurationMinutes: 45,
      difficulty: 'hard',
      description: 'Extended 6-minute run blocks.',
      summary: '4×(6 min run + 3 min walk)',
      segments: createSegments([
        { type: 'warmup', minutes: 4, label: 'Easy walk' },
        ...repeatIntervals(6, 3, 4, 'Steady run', 'Recovery walk'),
        { type: 'cooldown', minutes: 5, label: 'Easy walk' },
      ]),
    },
  },

  {
    level: 8,
    week: 4,
    name: 'Run Strong',
    focus: '8-minute continuous runs',
    description: 'Eight minutes at a time. The longest yet.',
    unlockCriteria: '3 sessions at Level 7',

    recommendedTemplate: {
      variant: 'recommended',
      title: '30-min 8-Min Runs',
      totalDurationMinutes: 30,
      difficulty: 'challenging',
      description: 'Two 8-minute runs with recovery.',
      summary: '3 min warmup → 2×(8 min run + 3 min walk) → 3 min cooldown',
      segments: createSegments([
        { type: 'warmup', minutes: 3, label: 'Easy walk' },
        { type: 'run', minutes: 8, label: 'Steady run' },
        { type: 'walk', minutes: 3, label: 'Recovery walk' },
        { type: 'run', minutes: 8, label: 'Steady run' },
        { type: 'walk', minutes: 3, label: 'Recovery walk' },
        { type: 'cooldown', minutes: 3, label: 'Easy walk' },
      ]),
    },

    quickTemplate: {
      variant: 'quick',
      title: '24-min Single Long Run',
      totalDurationMinutes: 24,
      difficulty: 'moderate',
      description: 'One strong 8-minute run.',
      summary: 'Single 8-min run with warmup/cooldown',
      segments: createSegments([
        { type: 'warmup', minutes: 4, label: 'Easy walk' },
        { type: 'walk', minutes: 3, label: 'Brisk walk' },
        { type: 'run', minutes: 8, label: 'Steady run' },
        { type: 'walk', minutes: 3, label: 'Recovery walk' },
        { type: 'cooldown', minutes: 4, label: 'Easy walk' },
      ]),
    },

    challengeTemplate: {
      variant: 'challenge',
      title: '38-min Challenge',
      totalDurationMinutes: 38,
      difficulty: 'challenging',
      description: 'Three 8-minute runs.',
      summary: '3×(8 min run + 2 min walk)',
      segments: createSegments([
        { type: 'warmup', minutes: 3, label: 'Easy walk' },
        { type: 'run', minutes: 8, label: 'Steady run' },
        { type: 'walk', minutes: 2, label: 'Recovery walk' },
        { type: 'run', minutes: 8, label: 'Steady run' },
        { type: 'walk', minutes: 2, label: 'Recovery walk' },
        { type: 'run', minutes: 8, label: 'Steady run' },
        { type: 'walk', minutes: 2, label: 'Recovery walk' },
        { type: 'cooldown', minutes: 3, label: 'Easy walk' },
      ]),
    },

    pushTemplate: {
      variant: 'push',
      title: '48-min Extended',
      totalDurationMinutes: 48,
      difficulty: 'hard',
      description: '10-minute run blocks for serious endurance.',
      summary: '3×(10 min run + 3 min walk)',
      segments: createSegments([
        { type: 'warmup', minutes: 4, label: 'Easy walk' },
        { type: 'run', minutes: 10, label: 'Steady run' },
        { type: 'walk', minutes: 3, label: 'Recovery walk' },
        { type: 'run', minutes: 10, label: 'Steady run' },
        { type: 'walk', minutes: 3, label: 'Recovery walk' },
        { type: 'run', minutes: 10, label: 'Steady run' },
        { type: 'walk', minutes: 3, label: 'Recovery walk' },
        { type: 'cooldown', minutes: 4, label: 'Easy walk' },
      ]),
    },
  },

  // ──────────────────────────────────────────
  // WEEKS 9-10: APPROACHING CONTINUOUS RUNNING
  // ──────────────────────────────────────────
  {
    level: 9,
    week: 5,
    name: 'Long Runs Begin',
    focus: '10-minute continuous runs',
    description: "Ten minutes of running. You're more than halfway to 5K.",
    unlockCriteria: '3 sessions at Level 8',

    recommendedTemplate: {
      variant: 'recommended',
      title: '32-min Long Intervals',
      totalDurationMinutes: 32,
      difficulty: 'challenging',
      description: 'Two 10-minute runs. This is real running.',
      summary: '3 min warmup → 10 min run → 3 min walk → 10 min run → 3 min cooldown',
      segments: createSegments([
        { type: 'warmup', minutes: 3, label: 'Easy walk' },
        { type: 'run', minutes: 10, label: 'Steady run' },
        { type: 'walk', minutes: 3, label: 'Recovery walk' },
        { type: 'run', minutes: 10, label: 'Steady run' },
        { type: 'walk', minutes: 3, label: 'Recovery walk' },
        { type: 'cooldown', minutes: 3, label: 'Easy walk' },
      ]),
    },

    quickTemplate: {
      variant: 'quick',
      title: '26-min Quick Long',
      totalDurationMinutes: 26,
      difficulty: 'moderate',
      description: 'One solid 10-minute run with buildup.',
      summary: 'Build to 10-min run',
      segments: createSegments([
        { type: 'warmup', minutes: 3, label: 'Easy walk' },
        { type: 'walk', minutes: 3, label: 'Brisk walk' },
        { type: 'run', minutes: 5, label: 'Easy run' },
        { type: 'run', minutes: 10, label: 'Steady run' },
        { type: 'cooldown', minutes: 5, label: 'Easy walk' },
      ]),
    },

    challengeTemplate: {
      variant: 'challenge',
      title: '40-min Challenge',
      totalDurationMinutes: 40,
      difficulty: 'challenging',
      description: 'Extended with 12-minute runs.',
      summary: '2×(12 min run + 3 min walk)',
      segments: createSegments([
        { type: 'warmup', minutes: 4, label: 'Easy walk' },
        { type: 'run', minutes: 12, label: 'Steady run' },
        { type: 'walk', minutes: 3, label: 'Recovery walk' },
        { type: 'run', minutes: 12, label: 'Steady run' },
        { type: 'walk', minutes: 3, label: 'Recovery walk' },
        { type: 'cooldown', minutes: 4, label: 'Easy walk' },
      ]),
    },

    pushTemplate: {
      variant: 'push',
      title: '50-min Endurance',
      totalDurationMinutes: 50,
      difficulty: 'hard',
      description: 'Three 12-minute runs for serious building.',
      summary: '3×(12 min run + 3 min walk)',
      segments: createSegments([
        { type: 'warmup', minutes: 4, label: 'Easy walk' },
        { type: 'run', minutes: 12, label: 'Steady run' },
        { type: 'walk', minutes: 3, label: 'Recovery walk' },
        { type: 'run', minutes: 12, label: 'Steady run' },
        { type: 'walk', minutes: 3, label: 'Recovery walk' },
        { type: 'run', minutes: 12, label: 'Steady run' },
        { type: 'walk', minutes: 3, label: 'Recovery walk' },
        { type: 'cooldown', minutes: 4, label: 'Easy walk' },
      ]),
    },
  },

  {
    level: 10,
    week: 5,
    name: 'Runner Emerging',
    focus: '12-15 minute continuous runs',
    description: "Fifteen minutes of running. You're close to continuous.",
    unlockCriteria: '3 sessions at Level 9',

    recommendedTemplate: {
      variant: 'recommended',
      title: '35-min Builder',
      totalDurationMinutes: 35,
      difficulty: 'challenging',
      description: 'Two 12-minute runs. Almost continuous.',
      summary: '12 min run → 3 min walk → 12 min run',
      segments: createSegments([
        { type: 'warmup', minutes: 3, label: 'Easy walk' },
        { type: 'run', minutes: 12, label: 'Steady run' },
        { type: 'walk', minutes: 3, label: 'Recovery walk' },
        { type: 'run', minutes: 12, label: 'Steady run' },
        { type: 'cooldown', minutes: 5, label: 'Easy walk' },
      ]),
    },

    quickTemplate: {
      variant: 'quick',
      title: '28-min Quick Builder',
      totalDurationMinutes: 28,
      difficulty: 'moderate',
      description: 'Single 15-minute run focus.',
      summary: 'Single 15-min continuous run',
      segments: createSegments([
        { type: 'warmup', minutes: 4, label: 'Easy walk' },
        { type: 'run', minutes: 15, label: 'Steady run' },
        { type: 'walk', minutes: 4, label: 'Recovery walk' },
        { type: 'cooldown', minutes: 5, label: 'Easy walk' },
      ]),
    },

    challengeTemplate: {
      variant: 'challenge',
      title: '42-min Challenge',
      totalDurationMinutes: 42,
      difficulty: 'challenging',
      description: 'Two 15-minute runs.',
      summary: '2×(15 min run + 3 min walk)',
      segments: createSegments([
        { type: 'warmup', minutes: 3, label: 'Easy walk' },
        { type: 'run', minutes: 15, label: 'Steady run' },
        { type: 'walk', minutes: 3, label: 'Recovery walk' },
        { type: 'run', minutes: 15, label: 'Steady run' },
        { type: 'cooldown', minutes: 6, label: 'Easy walk' },
      ]),
    },

    pushTemplate: {
      variant: 'push',
      title: '55-min Extended',
      totalDurationMinutes: 55,
      difficulty: 'hard',
      description: 'Build toward 20-minute continuous.',
      summary: '15 min run → 5 min walk → 20 min run',
      segments: createSegments([
        { type: 'warmup', minutes: 4, label: 'Easy walk' },
        { type: 'run', minutes: 15, label: 'Steady run' },
        { type: 'walk', minutes: 5, label: 'Recovery walk' },
        { type: 'run', minutes: 20, label: 'Strong run' },
        { type: 'walk', minutes: 5, label: 'Recovery walk' },
        { type: 'cooldown', minutes: 6, label: 'Easy walk' },
      ]),
    },
  },

  // ──────────────────────────────────────────
  // WEEKS 11-12: CONTINUOUS RUNNING
  // ──────────────────────────────────────────
  {
    level: 11,
    week: 6,
    name: 'First Continuous Run',
    focus: '20-minute non-stop run',
    description: "Twenty minutes. No walking. You're doing this.",
    unlockCriteria: '3 sessions at Level 10',

    recommendedTemplate: {
      variant: 'recommended',
      title: '35-min 20-Min Run',
      totalDurationMinutes: 35,
      difficulty: 'challenging',
      description: 'Your first 20-minute continuous run.',
      summary: '5 min warmup → 20 min run → 5 min cooldown',
      segments: createSegments([
        { type: 'warmup', minutes: 5, label: 'Easy walk' },
        { type: 'walk', minutes: 2, label: 'Brisk walk' },
        { type: 'run', minutes: 20, label: "Steady run — you've got this" },
        { type: 'cooldown', minutes: 5, label: 'Easy walk' },
        { type: 'cooldown', minutes: 3, label: 'Stretch' },
      ]),
    },

    quickTemplate: {
      variant: 'quick',
      title: '28-min Quick 20',
      totalDurationMinutes: 28,
      difficulty: 'moderate',
      description: 'Straight to the 20-minute run.',
      summary: '3 min warmup → 20 min run → 5 min cooldown',
      segments: createSegments([
        { type: 'warmup', minutes: 3, label: 'Easy walk' },
        { type: 'run', minutes: 20, label: 'Steady run' },
        { type: 'cooldown', minutes: 5, label: 'Easy walk' },
      ]),
    },

    challengeTemplate: {
      variant: 'challenge',
      title: '42-min Challenge',
      totalDurationMinutes: 42,
      difficulty: 'challenging',
      description: '25-minute continuous run.',
      summary: '25 min continuous run',
      segments: createSegments([
        { type: 'warmup', minutes: 5, label: 'Easy walk' },
        { type: 'walk', minutes: 2, label: 'Brisk walk' },
        { type: 'run', minutes: 25, label: 'Steady run' },
        { type: 'walk', minutes: 3, label: 'Recovery walk' },
        { type: 'cooldown', minutes: 5, label: 'Easy walk' },
      ]),
    },

    pushTemplate: {
      variant: 'push',
      title: '52-min Extended',
      totalDurationMinutes: 52,
      difficulty: 'hard',
      description: '28-minute run — approaching 5K time.',
      summary: '28 min continuous run',
      segments: createSegments([
        { type: 'warmup', minutes: 5, label: 'Easy walk' },
        { type: 'walk', minutes: 3, label: 'Brisk walk' },
        { type: 'run', minutes: 28, label: 'Strong steady run' },
        { type: 'walk', minutes: 5, label: 'Recovery walk' },
        { type: 'cooldown', minutes: 6, label: 'Easy walk' },
      ]),
    },
  },

  {
    level: 12,
    week: 6,
    name: 'Run Endurance',
    focus: '25-minute non-stop run',
    description: 'Twenty-five minutes continuous. 5K is in sight.',
    unlockCriteria: '3 sessions at Level 11',

    recommendedTemplate: {
      variant: 'recommended',
      title: '38-min 25-Min Run',
      totalDurationMinutes: 38,
      difficulty: 'challenging',
      description: '25 minutes continuous running.',
      summary: '5 min warmup → 25 min run → 5 min cooldown',
      segments: createSegments([
        { type: 'warmup', minutes: 5, label: 'Easy walk' },
        { type: 'walk', minutes: 2, label: 'Brisk walk' },
        { type: 'run', minutes: 25, label: 'Steady run' },
        { type: 'cooldown', minutes: 6, label: 'Easy walk' },
      ]),
    },

    quickTemplate: {
      variant: 'quick',
      title: '32-min Quick 25',
      totalDurationMinutes: 32,
      difficulty: 'moderate',
      description: 'Condensed warmup, same 25-minute run.',
      summary: '3 min warmup → 25 min run → 4 min cooldown',
      segments: createSegments([
        { type: 'warmup', minutes: 3, label: 'Easy walk' },
        { type: 'run', minutes: 25, label: 'Steady run' },
        { type: 'cooldown', minutes: 4, label: 'Easy walk' },
      ]),
    },

    challengeTemplate: {
      variant: 'challenge',
      title: '45-min Challenge',
      totalDurationMinutes: 45,
      difficulty: 'challenging',
      description: '30-minute continuous run.',
      summary: '30 min continuous run',
      segments: createSegments([
        { type: 'warmup', minutes: 5, label: 'Easy walk' },
        { type: 'walk', minutes: 2, label: 'Brisk walk' },
        { type: 'run', minutes: 30, label: 'Steady run' },
        { type: 'cooldown', minutes: 5, label: 'Easy walk' },
      ]),
    },

    pushTemplate: {
      variant: 'push',
      title: '55-min Extended',
      totalDurationMinutes: 55,
      difficulty: 'hard',
      description: '32-minute run — building to 5K.',
      summary: '32 min continuous run',
      segments: createSegments([
        { type: 'warmup', minutes: 5, label: 'Easy walk' },
        { type: 'walk', minutes: 3, label: 'Brisk walk' },
        { type: 'run', minutes: 32, label: 'Strong steady run' },
        { type: 'walk', minutes: 5, label: 'Recovery walk' },
        { type: 'cooldown', minutes: 5, label: 'Easy walk' },
      ]),
    },
  },

  // ──────────────────────────────────────────
  // WEEKS 13-14: BUILDING TO 5K DISTANCE
  // ──────────────────────────────────────────
  {
    level: 13,
    week: 7,
    name: 'Distance Focus',
    focus: '30-minute run (3-3.5km)',
    description: "Thirty minutes. You're running real distances now.",
    unlockCriteria: '3 sessions at Level 12',

    recommendedTemplate: {
      variant: 'recommended',
      title: '42-min 30-Min Run',
      totalDurationMinutes: 42,
      difficulty: 'challenging',
      description: '30 minutes continuous — aiming for 3+ km.',
      summary: '5 min warmup → 30 min run → 5 min cooldown',
      segments: createSegments([
        { type: 'warmup', minutes: 5, label: 'Easy walk' },
        { type: 'walk', minutes: 2, label: 'Brisk walk' },
        { type: 'run', minutes: 30, label: 'Steady run — find your rhythm' },
        { type: 'cooldown', minutes: 5, label: 'Easy walk' },
      ]),
    },

    quickTemplate: {
      variant: 'quick',
      title: '35-min Quick Distance',
      totalDurationMinutes: 35,
      difficulty: 'moderate',
      description: '25-minute run with quick warmup.',
      summary: '25 min run',
      segments: createSegments([
        { type: 'warmup', minutes: 4, label: 'Easy walk' },
        { type: 'run', minutes: 25, label: 'Steady run' },
        { type: 'cooldown', minutes: 6, label: 'Easy walk' },
      ]),
    },

    challengeTemplate: {
      variant: 'challenge',
      title: '50-min Challenge',
      totalDurationMinutes: 50,
      difficulty: 'hard',
      description: '35-minute continuous run.',
      summary: '35 min continuous run',
      segments: createSegments([
        { type: 'warmup', minutes: 5, label: 'Easy walk' },
        { type: 'walk', minutes: 2, label: 'Brisk walk' },
        { type: 'run', minutes: 35, label: 'Steady run' },
        { type: 'cooldown', minutes: 5, label: 'Easy walk' },
      ]),
    },

    pushTemplate: {
      variant: 'push',
      title: '60-min Extended',
      totalDurationMinutes: 60,
      difficulty: 'hard',
      description: '40-minute run — approaching 5K time for most.',
      summary: '40 min continuous run',
      segments: createSegments([
        { type: 'warmup', minutes: 5, label: 'Easy walk' },
        { type: 'walk', minutes: 3, label: 'Brisk walk' },
        { type: 'run', minutes: 40, label: 'Strong steady run' },
        { type: 'walk', minutes: 5, label: 'Recovery walk' },
        { type: 'cooldown', minutes: 5, label: 'Easy walk' },
      ]),
    },
  },

  {
    level: 14,
    week: 7,
    name: '5K in Sight',
    focus: '35-minute run (4+ km)',
    description: 'Thirty-five minutes. You can almost see the finish line.',
    unlockCriteria: '3 sessions at Level 13',

    recommendedTemplate: {
      variant: 'recommended',
      title: '48-min 35-Min Run',
      totalDurationMinutes: 48,
      difficulty: 'challenging',
      description: '35 minutes continuous — 4+ km for most.',
      summary: '5 min warmup → 35 min run → 5 min cooldown',
      segments: createSegments([
        { type: 'warmup', minutes: 5, label: 'Easy walk' },
        { type: 'walk', minutes: 2, label: 'Brisk walk' },
        { type: 'run', minutes: 35, label: 'Steady run — 5K pace building' },
        { type: 'cooldown', minutes: 6, label: 'Easy walk' },
      ]),
    },

    quickTemplate: {
      variant: 'quick',
      title: '40-min Quick Long',
      totalDurationMinutes: 40,
      difficulty: 'moderate',
      description: '30-minute run.',
      summary: '30 min run',
      segments: createSegments([
        { type: 'warmup', minutes: 4, label: 'Easy walk' },
        { type: 'run', minutes: 30, label: 'Steady run' },
        { type: 'cooldown', minutes: 6, label: 'Easy walk' },
      ]),
    },

    challengeTemplate: {
      variant: 'challenge',
      title: '55-min Challenge',
      totalDurationMinutes: 55,
      difficulty: 'hard',
      description: '40-minute continuous run.',
      summary: '40 min continuous run',
      segments: createSegments([
        { type: 'warmup', minutes: 5, label: 'Easy walk' },
        { type: 'walk', minutes: 2, label: 'Brisk walk' },
        { type: 'run', minutes: 40, label: 'Steady run' },
        { type: 'cooldown', minutes: 5, label: 'Easy walk' },
      ]),
    },

    pushTemplate: {
      variant: 'push',
      title: '65-min Extended',
      totalDurationMinutes: 65,
      difficulty: 'hard',
      description: '45-minute run — 5K and beyond.',
      summary: '45 min continuous run',
      segments: createSegments([
        { type: 'warmup', minutes: 5, label: 'Easy walk' },
        { type: 'walk', minutes: 3, label: 'Brisk walk' },
        { type: 'run', minutes: 45, label: 'Strong steady run' },
        { type: 'walk', minutes: 5, label: 'Recovery walk' },
        { type: 'cooldown', minutes: 5, label: 'Easy walk' },
      ]),
    },
  },

  // ──────────────────────────────────────────
  // WEEKS 15-16: 5K ACHIEVEMENT
  // ──────────────────────────────────────────
  {
    level: 15,
    week: 8,
    name: 'Almost There',
    focus: '40-minute run (4.5+ km)',
    description: 'Forty minutes. The 5K is within reach.',
    unlockCriteria: '3 sessions at Level 14',

    recommendedTemplate: {
      variant: 'recommended',
      title: '52-min 40-Min Run',
      totalDurationMinutes: 52,
      difficulty: 'hard',
      description: '40 minutes continuous — 4.5+ km for most.',
      summary: '5 min warmup → 40 min run → 5 min cooldown',
      segments: createSegments([
        { type: 'warmup', minutes: 5, label: 'Easy walk' },
        { type: 'walk', minutes: 2, label: 'Brisk walk' },
        { type: 'run', minutes: 40, label: 'Steady run — almost at 5K' },
        { type: 'cooldown', minutes: 5, label: 'Easy walk' },
      ]),
    },

    quickTemplate: {
      variant: 'quick',
      title: '42-min Quick Long',
      totalDurationMinutes: 42,
      difficulty: 'challenging',
      description: '32-minute run.',
      summary: '32 min run',
      segments: createSegments([
        { type: 'warmup', minutes: 4, label: 'Easy walk' },
        { type: 'run', minutes: 32, label: 'Steady run' },
        { type: 'cooldown', minutes: 6, label: 'Easy walk' },
      ]),
    },

    challengeTemplate: {
      variant: 'challenge',
      title: '60-min Challenge',
      totalDurationMinutes: 60,
      difficulty: 'hard',
      description: '45-minute continuous run.',
      summary: '45 min continuous run',
      segments: createSegments([
        { type: 'warmup', minutes: 5, label: 'Easy walk' },
        { type: 'walk', minutes: 2, label: 'Brisk walk' },
        { type: 'run', minutes: 45, label: 'Steady run' },
        { type: 'cooldown', minutes: 5, label: 'Easy walk' },
      ]),
    },

    pushTemplate: {
      variant: 'push',
      title: '70-min Extended',
      totalDurationMinutes: 70,
      difficulty: 'hard',
      description: '50+ minute run — beyond 5K prep.',
      summary: '50 min continuous run',
      segments: createSegments([
        { type: 'warmup', minutes: 5, label: 'Easy walk' },
        { type: 'walk', minutes: 3, label: 'Brisk walk' },
        { type: 'run', minutes: 50, label: 'Strong steady run' },
        { type: 'walk', minutes: 5, label: 'Recovery walk' },
        { type: 'cooldown', minutes: 5, label: 'Easy walk' },
      ]),
    },
  },

  {
    level: 16,
    week: 8,
    name: '5K Runner',
    focus: 'Run 5K — You Did It',
    description: "This is it. Run 5K. You're a runner now.",
    unlockCriteria: '3 sessions at Level 15',

    recommendedTemplate: {
      variant: 'recommended',
      title: '5K Run',
      totalDurationMinutes: 50,
      difficulty: 'hard',
      description: 'Run until you hit 5K. Use GPS to track distance.',
      summary: 'Run 5K — distance goal, not time',
      segments: createSegments([
        { type: 'warmup', minutes: 5, label: 'Easy walk' },
        { type: 'walk', minutes: 2, label: 'Brisk walk' },
        { type: 'run', minutes: 35, label: "Run until 5K — you're a runner now" },
        { type: 'cooldown', minutes: 5, label: 'Victory walk' },
      ]),
    },

    quickTemplate: {
      variant: 'quick',
      title: '5K Quick Start',
      totalDurationMinutes: 42,
      difficulty: 'challenging',
      description: 'Condensed warmup, same 5K goal.',
      summary: '5K run with quick warmup',
      segments: createSegments([
        { type: 'warmup', minutes: 3, label: 'Easy walk' },
        { type: 'run', minutes: 35, label: 'Run until 5K' },
        { type: 'cooldown', minutes: 4, label: 'Easy walk' },
      ]),
    },

    challengeTemplate: {
      variant: 'challenge',
      title: '5K Time Trial',
      totalDurationMinutes: 55,
      difficulty: 'hard',
      description: 'Push your 5K pace.',
      summary: '5K run — push your pace',
      segments: createSegments([
        { type: 'warmup', minutes: 5, label: 'Easy walk' },
        { type: 'walk', minutes: 3, label: 'Brisk walk' },
        { type: 'run', minutes: 35, label: '5K — find your fastest comfortable pace' },
        { type: 'cooldown', minutes: 8, label: 'Recovery walk' },
      ]),
    },

    pushTemplate: {
      variant: 'push',
      title: 'Beyond 5K',
      totalDurationMinutes: 70,
      difficulty: 'hard',
      description: 'Ready for more? Run beyond 5K.',
      summary: '6K+ run — beyond 5K',
      segments: createSegments([
        { type: 'warmup', minutes: 5, label: 'Easy walk' },
        { type: 'walk', minutes: 3, label: 'Brisk walk' },
        { type: 'run', minutes: 50, label: "Run beyond 5K — you're unstoppable" },
        { type: 'cooldown', minutes: 8, label: 'Victory walk' },
      ]),
    },
  },
];

// ============================================
// HELPERS
// ============================================

export const getLevelDefinition = (level: number): LevelDefinition | undefined =>
  LEVEL_DEFINITIONS.find((l) => l.level === level);

export const getSessionTemplatesForLevel = (
  level: number,
): {
  recommended: SessionTemplate;
  quick: SessionTemplate;
  challenge: SessionTemplate;
  push: SessionTemplate;
} | undefined => {
  const levelDef = getLevelDefinition(level);
  if (!levelDef) return undefined;

  return {
    recommended: levelDef.recommendedTemplate,
    quick: levelDef.quickTemplate,
    challenge: levelDef.challengeTemplate,
    push: levelDef.pushTemplate,
  };
};

export const generateSessionPlan = (template: SessionTemplate, level: number): SessionPlan => {
  const difficulty = template.difficulty;
  const difficultyLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);

  return {
    id: `${level}-${template.variant}-${Date.now()}`,
    level,
    variant: template.variant,
    title: template.title,
    subtitle: `Level ${level} · ${difficultyLabel}`,
    description: template.description,
    totalDurationMinutes: template.totalDurationMinutes,
    difficulty,
    segments: template.segments.map((seg, index) => ({
      ...seg,
      id: `seg-${index}-${Date.now()}`,
    })),
    isRecommended: template.variant === 'recommended',
    summary: template.summary,
  };
};
