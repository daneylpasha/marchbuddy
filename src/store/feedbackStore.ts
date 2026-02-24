import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface FeedbackState {
  // Coach chat banner (shown for first 7 days after onboarding)
  coachBannerDismissed: boolean;

  // In-app rating nudge on the Progress screen
  ratingPromptCompleted: boolean;       // true = never show again
  ratingPromptSnoozedUntil: string | null; // ISO date YYYY-MM-DD

  // Actions
  dismissCoachBanner: () => void;
  completeRatingPrompt: () => void;
  snoozeRatingPrompt: () => void;       // snooze for 14 days
  shouldShowRatingNudge: (totalSessions: number, onboardingDate: string | null) => boolean;
}

export const useFeedbackStore = create<FeedbackState>()(
  persist(
    (set, get) => ({
      coachBannerDismissed: false,
      ratingPromptCompleted: false,
      ratingPromptSnoozedUntil: null,

      dismissCoachBanner: () => set({ coachBannerDismissed: true }),

      completeRatingPrompt: () => set({ ratingPromptCompleted: true }),

      snoozeRatingPrompt: () => {
        const snoozeUntil = new Date();
        snoozeUntil.setDate(snoozeUntil.getDate() + 14);
        set({ ratingPromptSnoozedUntil: snoozeUntil.toISOString().split('T')[0] });
      },

      shouldShowRatingNudge: (totalSessions, onboardingDate) => {
        const { ratingPromptCompleted, ratingPromptSnoozedUntil } = get();

        if (ratingPromptCompleted) return false;
        if (totalSessions < 10) return false;
        if (!onboardingDate) return false;

        const onboarded = new Date(onboardingDate);
        const now = new Date();
        onboarded.setHours(0, 0, 0, 0);
        now.setHours(0, 0, 0, 0);
        const daysSince = Math.floor(
          (now.getTime() - onboarded.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysSince < 7) return false;

        if (ratingPromptSnoozedUntil) {
          const today = new Date().toISOString().split('T')[0];
          if (today < ratingPromptSnoozedUntil) return false;
        }

        return true;
      },
    }),
    {
      name: 'march-buddy-feedback',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
