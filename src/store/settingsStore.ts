import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsState {
  distanceUnit: 'km' | 'miles';
  hapticFeedbackEnabled: boolean;
  voiceCuesEnabled: boolean;
  hasSeenFeatureTips: boolean;
  hasSeenIntro: boolean;

  setDistanceUnit: (unit: 'km' | 'miles') => void;
  setHapticFeedbackEnabled: (enabled: boolean) => void;
  setVoiceCuesEnabled: (enabled: boolean) => void;
  setHasSeenFeatureTips: (seen: boolean) => void;
  setHasSeenIntro: (seen: boolean) => void;
  resetSettings: () => void;
}

const defaultSettings = {
  distanceUnit: 'km' as const,
  hapticFeedbackEnabled: true,
  voiceCuesEnabled: true,
  hasSeenFeatureTips: false,
  hasSeenIntro: false,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,

      setDistanceUnit: (unit) => set({ distanceUnit: unit }),
      setHapticFeedbackEnabled: (enabled) => set({ hapticFeedbackEnabled: enabled }),
      setVoiceCuesEnabled: (enabled) => set({ voiceCuesEnabled: enabled }),
      setHasSeenFeatureTips: (seen) => set({ hasSeenFeatureTips: seen }),
      setHasSeenIntro: (seen) => set({ hasSeenIntro: seen }),
      resetSettings: () => set(defaultSettings),
    }),
    {
      name: 'march-buddy-settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
