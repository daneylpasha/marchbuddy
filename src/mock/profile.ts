import type { UserProfile } from '../types';

const today = new Date().toISOString();

export const mockProfile: UserProfile = {
  userId: '00000000-0000-0000-0000-000000000001',
  name: 'Alex',
  age: 27,
  gender: 'male',
  height: 178,
  currentWeight: 82.5,
  targetWeight: 75,
  fitnessHistory: 'intermediate',
  pastSports: ['Basketball', 'Swimming'],
  peakFitnessLevel: 'advanced',
  currentActivityLevel: 'moderate',
  injuries: ['Minor lower-back tightness'],
  dietaryPreferences: {
    type: 'non-veg',
    allergies: ['Shellfish'],
    dislikes: ['Bitter gourd'],
    cuisineRegion: 'South Asian',
  },
  goals: {
    primaryGoal: 'Lose fat & build lean muscle',
    targetTimeline: '12 weeks',
    targetWeight: 75,
  },
  eatingContext: { cooksForSelf: 'mostly', eatsOutFrequency: '2x per week' },
  workoutSchedule: { daysPerWeek: '5', timePreference: 'morning' },
  equipmentAvailable: ['Dumbbells', 'Barbell', 'Cables', 'Pull-Up Bar', 'Machines'],
  onboardingCompleted: true,
  createdAt: '2025-12-01T08:00:00.000Z',
  updatedAt: today,
};
