import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsState {
  distanceUnit: 'km' | 'miles';
  notificationsEnabled: boolean;
  hapticFeedbackEnabled: boolean;

  setDistanceUnit: (unit: 'km' | 'miles') => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setHapticFeedbackEnabled: (enabled: boolean) => void;
  resetSettings: () => void;
}

const defaultSettings = {
  distanceUnit: 'km' as const,
  notificationsEnabled: true,
  hapticFeedbackEnabled: true,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,

      setDistanceUnit: (unit) => set({ distanceUnit: unit }),
      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
      setHapticFeedbackEnabled: (enabled) => set({ hapticFeedbackEnabled: enabled }),
      resetSettings: () => set(defaultSettings),
    }),
    {
      name: 'march-buddy-settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
