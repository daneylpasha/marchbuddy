import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface NotificationState {
  permissionStatus: 'undetermined' | 'granted' | 'denied';
  expoPushToken: string | null;
  lastNotificationTap: {
    sessionKey?: string;
    type?: string;
    timestamp?: number;
  } | null;
  lastPermissionPrompt: string | null; // ISO date — don't re-prompt more than once/week

  setPermissionStatus: (status: 'undetermined' | 'granted' | 'denied') => void;
  setExpoPushToken: (token: string) => void;
  setLastNotificationTap: (data: { sessionKey?: string; type?: string }) => void;
  clearNotificationTap: () => void;
  setLastPermissionPrompt: (date: string) => void;
  canPromptPermission: () => boolean;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      permissionStatus: 'undetermined',
      expoPushToken: null,
      lastNotificationTap: null,
      lastPermissionPrompt: null,

      setPermissionStatus: (status) => set({ permissionStatus: status }),

      setExpoPushToken: (token) => set({ expoPushToken: token }),

      setLastNotificationTap: (data) =>
        set({
          lastNotificationTap: { ...data, timestamp: Date.now() },
        }),

      clearNotificationTap: () => set({ lastNotificationTap: null }),

      setLastPermissionPrompt: (date) => set({ lastPermissionPrompt: date }),

      canPromptPermission: () => {
        const { permissionStatus, lastPermissionPrompt } = get();
        if (permissionStatus === 'granted') return false;
        if (!lastPermissionPrompt) return true;
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        return new Date(lastPermissionPrompt).getTime() < weekAgo;
      },
    }),
    {
      name: 'march-buddy-notifications',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
