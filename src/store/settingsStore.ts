import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsState {
  distanceUnit: 'km' | 'miles';
  hapticFeedbackEnabled: boolean;
  hasSeenFeatureTips: boolean;

  setDistanceUnit: (unit: 'km' | 'miles') => void;
  setHapticFeedbackEnabled: (enabled: boolean) => void;
  setHasSeenFeatureTips: (seen: boolean) => void;
  resetSettings: () => void;
}

const defaultSettings = {
  distanceUnit: 'km' as const,
  hapticFeedbackEnabled: true,
  hasSeenFeatureTips: false,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,

      setDistanceUnit: (unit) => set({ distanceUnit: unit }),
      setHapticFeedbackEnabled: (enabled) => set({ hapticFeedbackEnabled: enabled }),
      setHasSeenFeatureTips: (seen) => set({ hasSeenFeatureTips: seen }),
      resetSettings: () => set(defaultSettings),
    }),
    {
      name: 'march-buddy-settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
