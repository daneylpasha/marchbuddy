import type { BodyMeasurement, WeeklySummary, WeightEntry } from '../types';

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

/** Weight entries over the past 6 weeks showing gradual progress. */
export const mockWeightEntries: WeightEntry[] = [
  { id: 'e0000000-0000-0000-0000-000000000001', userId: '00000000-0000-0000-0000-000000000001', weight: 85.0, date: daysAgo(42) },
  { id: 'e0000000-0000-0000-0000-000000000002', userId: '00000000-0000-0000-0000-000000000001', weight: 84.8, date: daysAgo(39) },
  { id: 'e0000000-0000-0000-0000-000000000003', userId: '00000000-0000-0000-0000-000000000001', weight: 84.5, date: daysAgo(35) },
  { id: 'e0000000-0000-0000-0000-000000000004', userId: '00000000-0000-0000-0000-000000000001', weight: 84.6, date: daysAgo(32) },
  { id: 'e0000000-0000-0000-0000-000000000005', userId: '00000000-0000-0000-0000-000000000001', weight: 84.2, date: daysAgo(28) },
  { id: 'e0000000-0000-0000-0000-000000000006', userId: '00000000-0000-0000-0000-000000000001', weight: 84.0, date: daysAgo(25) },
  { id: 'e0000000-0000-0000-0000-000000000007', userId: '00000000-0000-0000-0000-000000000001', weight: 83.8, date: daysAgo(21) },
  { id: 'e0000000-0000-0000-0000-000000000008', userId: '00000000-0000-0000-0000-000000000001', weight: 83.5, date: daysAgo(18) },
  { id: 'e0000000-0000-0000-0000-000000000009', userId: '00000000-0000-0000-0000-000000000001', weight: 83.7, date: daysAgo(14) },
  { id: 'e0000000-0000-0000-0000-000000000010', userId: '00000000-0000-0000-0000-000000000001', weight: 83.3, date: daysAgo(11) },
  { id: 'e0000000-0000-0000-0000-000000000011', userId: '00000000-0000-0000-0000-000000000001', weight: 83.0, date: daysAgo(7) },
  { id: 'e0000000-0000-0000-0000-000000000012', userId: '00000000-0000-0000-0000-000000000001', weight: 82.8, date: daysAgo(4) },
  { id: 'e0000000-0000-0000-0000-000000000013', userId: '00000000-0000-0000-0000-000000000001', weight: 82.5, date: daysAgo(1) },
];

/** Body measurements taken bi-weekly. */
export const mockMeasurements: BodyMeasurement[] = [
  { id: 'f0000000-0000-0000-0000-000000000001', userId: '00000000-0000-0000-0000-000000000001', date: daysAgo(28), waist: 88, chest: 102, arms: 35, notes: 'Starting measurements' },
  { id: 'f0000000-0000-0000-0000-000000000002', userId: '00000000-0000-0000-0000-000000000001', date: daysAgo(14), waist: 86.5, chest: 102.5, arms: 35.5, notes: 'Waist coming down' },
  { id: 'f0000000-0000-0000-0000-000000000003', userId: '00000000-0000-0000-0000-000000000001', date: daysAgo(0), waist: 85, chest: 103, arms: 36, notes: 'Good progress on waist, arms growing' },
];

/** Weekly AI-generated summaries. */
export const mockWeeklySummaries: WeeklySummary[] = [
  {
    id: 'f1000000-0000-0000-0000-000000000001',
    userId: '00000000-0000-0000-0000-000000000001',
    weekStartDate: daysAgo(7),
    summaryText: 'Strong week overall. You completed 5 out of 5 planned workouts and stayed within your calorie targets on 6 days. Your bench press volume increased by 5% and bodyweight dropped 0.5 kg. Keep pushing on the compound lifts.',
    insights: [
      'Bench press strength is trending up consistently',
      'Protein intake averaged 158g/day — try to hit 165g more often',
      'Sleep quality dipped mid-week; this correlated with a harder Thursday session',
      'Water intake was excellent — above 2L every day',
    ],
    createdAt: daysAgo(1) + 'T08:00:00.000Z',
  },
  {
    id: 'f1000000-0000-0000-0000-000000000002',
    userId: '00000000-0000-0000-0000-000000000001',
    weekStartDate: daysAgo(14),
    summaryText: 'Good consistency this week with 4 out of 5 workouts completed. You skipped Friday due to low energy but made it up with an extra active-recovery session. Nutrition was on point with an average deficit of ~350 cal/day.',
    insights: [
      'Recovery days are helping — soreness scores improved',
      'Squat depth improved based on form feedback',
      'Consider adding a second rest day if energy stays low',
      'Weekend meals had more carbs than planned — watch portions',
    ],
    createdAt: daysAgo(8) + 'T08:00:00.000Z',
  },
];

/** Dates with completed workouts for streak/consistency tracking. */
export const mockWorkoutDates: { date: string }[] = [
  { date: daysAgo(0) },
  { date: daysAgo(1) },
  { date: daysAgo(3) },
  { date: daysAgo(4) },
  { date: daysAgo(5) },
  { date: daysAgo(7) },
  { date: daysAgo(8) },
  { date: daysAgo(10) },
  { date: daysAgo(11) },
  { date: daysAgo(12) },
  { date: daysAgo(14) },
  { date: daysAgo(15) },
];
