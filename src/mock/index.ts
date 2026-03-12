/**
 * Mock Data — Central hub
 *
 * Toggle MOCK_MODE to true to see the app with realistic populated data.
 * Set back to false for production / real Supabase data.
 *
 * Usage:
 *   import { MOCK_MODE, injectMockData } from '../mock';
 *   if (MOCK_MODE) injectMockData();
 */

/** Flip this to true to preview the app with populated data. */
export const MOCK_MODE = false;

import { useAuthStore } from '../store/authStore';
import { useProfileStore } from '../store/profileStore';
import { useWorkoutStore } from '../store/workoutStore';
import { useNutritionStore } from '../store/nutritionStore';
import { useWaterStore } from '../store/waterStore';
import { useProgressStore } from '../store/progressStore';
import { useChatStore } from '../store/chatStore';

import { mockProfile } from './profile';
import { mockWorkout, mockWorkoutHistory } from './workout';
import { mockMealPlan, mockFoodSnaps } from './nutrition';
import { mockWaterLog } from './water';
import { mockWeightEntries, mockMeasurements, mockWeeklySummaries } from './progress';
import { mockChatMessages } from './chat';

/** Inject mock data into all Zustand stores at once. */
export function injectMockData() {
  useAuthStore.setState({
    user: { id: '00000000-0000-0000-0000-000000000001', email: 'alex@example.com', createdAt: '2025-12-01T08:00:00.000Z' },
    isAuthenticated: true,
    isInitializing: false,
    isLoading: false,
  });

  useProfileStore.setState({
    profile: mockProfile,
    onboardingCompleted: true,
    isLoading: false,
  });

  useWorkoutStore.setState({
    todayWorkout: mockWorkout,
    isLoading: false,
    workoutHistory: mockWorkoutHistory,
    historyLoading: false,
  });

  useNutritionStore.setState({
    todayMealPlan: mockMealPlan,
    foodSnaps: mockFoodSnaps,
    isLoading: false,
  });

  useWaterStore.setState({
    todayWaterLog: mockWaterLog,
  });

  useProgressStore.setState({
    weightEntries: mockWeightEntries,
    measurements: mockMeasurements,
    weeklySummaries: mockWeeklySummaries,
    loaded: true,
    generatingSummary: false,
  });

  useChatStore.setState({
    messages: mockChatMessages as any,
    isLoading: false,
  });

  console.log('[Mock] All stores populated with mock data');
}

/** Clear all stores back to their default empty state. */
export function clearMockData() {
  useProfileStore.setState({ profile: null, onboardingCompleted: false });
  useWorkoutStore.setState({ todayWorkout: null, workoutHistory: [], summary: null });
  useNutritionStore.setState({ todayMealPlan: null, foodSnaps: [] });
  useWaterStore.setState({ todayWaterLog: null });
  useProgressStore.setState({ weightEntries: [], measurements: [], weeklySummaries: [], loaded: false });
  useChatStore.setState({ messages: [], isLoading: false });

  console.log('[Mock] All stores cleared');
}

// Re-export individual mocks for granular use
export { mockProfile } from './profile';
export { mockWorkout, mockRestDayWorkout, mockWorkoutHistory } from './workout';
export { mockMealPlan, mockFoodSnaps } from './nutrition';
export { mockWaterLog } from './water';
export { mockWeightEntries, mockMeasurements, mockWeeklySummaries, mockWorkoutDates } from './progress';
export { mockChatMessages } from './chat';
