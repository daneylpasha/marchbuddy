import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../api/supabase';

/**
 * Per-user notification preferences.
 *
 * Lives in two places:
 *   - Locally in AsyncStorage (so the client can pre-check before
 *     scheduling a local reminder)
 *   - Remotely on `profiles.notification_prefs` JSONB (so the server
 *     Edge Function can respect the same prefs when deciding whether
 *     to send a push)
 *
 * Any setter writes both locations. If the remote write fails (offline,
 * not authed, RLS issue) we still keep the local change — the remote
 * will sync on the next successful write.
 */

export interface NotificationPrefs {
  session_reminders: boolean;
  reengagement: boolean;
  community_events: boolean;
  // V2 Proactive Coach Messages — opt-out for the 4 trigger moments
  // (session_morning, post_session, missed_session, weekly_recap).
  // When false: scheduler skips this user entirely; sender cancels any
  // rows still in the queue.
  coach_proactive: boolean;
  // Buddy Codes — opt-out for buddy_request_received / buddy_request_accepted
  buddy_notifications: boolean;
  quiet_hours_start: number; // 0–23, user local time
  quiet_hours_end: number; // 0–23, user local time
}

export const DEFAULT_PREFS: NotificationPrefs = {
  session_reminders: true,
  reengagement: true,
  community_events: true,
  coach_proactive: true,
  buddy_notifications: true,
  quiet_hours_start: 22,
  quiet_hours_end: 7,
};

interface NotificationPrefsState {
  prefs: NotificationPrefs;
  syncedAt: string | null;

  setPref: <K extends keyof NotificationPrefs>(
    key: K,
    value: NotificationPrefs[K],
  ) => Promise<void>;
  setQuietHours: (start: number, end: number) => Promise<void>;
  hydrateFromServer: () => Promise<void>;
  resetPrefs: () => Promise<void>;
}

async function writeRemote(prefs: NotificationPrefs): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) return;

    await supabase.from('profiles').update({ notification_prefs: prefs }).eq('id', user.id);
  } catch (err) {
    // Best-effort — local state is source of truth for the session.
    console.warn('notificationPrefs: remote write failed:', err);
  }
}

export const useNotificationPrefsStore = create<NotificationPrefsState>()(
  persist(
    (set, get) => ({
      prefs: DEFAULT_PREFS,
      syncedAt: null,

      setPref: async (key, value) => {
        const next = { ...get().prefs, [key]: value };
        set({ prefs: next });
        await writeRemote(next);
        set({ syncedAt: new Date().toISOString() });
      },

      setQuietHours: async (start, end) => {
        const next = {
          ...get().prefs,
          quiet_hours_start: start,
          quiet_hours_end: end,
        };
        set({ prefs: next });
        await writeRemote(next);
        set({ syncedAt: new Date().toISOString() });
      },

      hydrateFromServer: async () => {
        try {
          const { data: authData } = await supabase.auth.getUser();
          const user = authData?.user;
          if (!user) return;

          const { data, error } = await supabase
            .from('profiles')
            .select('notification_prefs')
            .eq('id', user.id)
            .maybeSingle();

          if (error || !data?.notification_prefs) return;

          // Merge with defaults so a partial JSONB row doesn't blow us up
          set({
            prefs: { ...DEFAULT_PREFS, ...(data.notification_prefs as Partial<NotificationPrefs>) },
            syncedAt: new Date().toISOString(),
          });
        } catch (err) {
          console.warn('notificationPrefs: hydrate failed:', err);
        }
      },

      resetPrefs: async () => {
        set({ prefs: DEFAULT_PREFS });
        await writeRemote(DEFAULT_PREFS);
      },
    }),
    {
      name: 'march-buddy-notification-prefs',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
