import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../api/supabase';
import { useAuthStore } from './authStore';

export interface ScheduledSession {
  id: string;
  user_id: string;
  session_key: string;
  session_title: string;
  scheduled_at: string; // ISO 8601
  notified: boolean;
  local_notification_id: string | null;
  created_at: string;
}

interface ScheduleState {
  scheduledSessions: ScheduledSession[];

  scheduleSession: (
    sessionKey: string,
    title: string,
    scheduledAt: Date,
  ) => Promise<ScheduledSession>;

  updateSchedule: (
    id: string,
    sessionKey: string,
    title: string,
    scheduledAt: Date,
  ) => Promise<ScheduledSession>;

  cancelSchedule: (id: string) => Promise<void>;

  getScheduleForSession: (sessionKey: string) => ScheduledSession | undefined;

  fetchScheduledSessions: () => Promise<void>;

  setLocalNotificationId: (scheduleId: string, notificationId: string) => void;
}

function createLocalRow(sessionKey: string, title: string, scheduledAt: Date, id?: string): ScheduledSession {
  return {
    id: id ?? `local_${Date.now()}`,
    user_id: 'guest',
    session_key: sessionKey,
    session_title: title,
    scheduled_at: scheduledAt.toISOString(),
    notified: false,
    local_notification_id: null,
    created_at: new Date().toISOString(),
  };
}

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set, get) => ({
      scheduledSessions: [],

      scheduleSession: async (sessionKey, title, scheduledAt) => {
        const { isGuest, user } = useAuthStore.getState();

        if (isGuest || !user) {
          const row = createLocalRow(sessionKey, title, scheduledAt);
          set((s) => ({ scheduledSessions: [...s.scheduledSessions, row] }));
          return row;
        }

        const { data, error } = await supabase
          .from('scheduled_sessions')
          .insert({
            user_id: user.id,
            session_key: sessionKey,
            session_title: title,
            scheduled_at: scheduledAt.toISOString(),
          })
          .select()
          .single();

        if (error) throw new Error(error.message);

        const row = data as ScheduledSession;
        set((s) => ({ scheduledSessions: [...s.scheduledSessions, row] }));
        return row;
      },

      updateSchedule: async (id, sessionKey, title, scheduledAt) => {
        const { isGuest } = useAuthStore.getState();

        if (isGuest) {
          const row = createLocalRow(sessionKey, title, scheduledAt, id);
          set((s) => ({
            scheduledSessions: s.scheduledSessions.map((ss) => (ss.id === id ? row : ss)),
          }));
          return row;
        }

        const { data, error } = await supabase
          .from('scheduled_sessions')
          .update({
            session_key: sessionKey,
            session_title: title,
            scheduled_at: scheduledAt.toISOString(),
          })
          .eq('id', id)
          .select()
          .single();

        if (error) throw new Error(error.message);

        const row = data as ScheduledSession;
        set((s) => ({
          scheduledSessions: s.scheduledSessions.map((ss) => (ss.id === id ? row : ss)),
        }));
        return row;
      },

      cancelSchedule: async (id) => {
        const { isGuest } = useAuthStore.getState();

        if (!isGuest) {
          const { error } = await supabase
            .from('scheduled_sessions')
            .delete()
            .eq('id', id);

          if (error) throw new Error(error.message);
        }

        set((s) => ({
          scheduledSessions: s.scheduledSessions.filter((ss) => ss.id !== id),
        }));
      },

      getScheduleForSession: (sessionKey) => {
        return get().scheduledSessions.find(
          (ss) =>
            ss.session_key === sessionKey &&
            new Date(ss.scheduled_at) > new Date(),
        );
      },

      fetchScheduledSessions: async () => {
        const { data, error } = await supabase
          .from('scheduled_sessions')
          .select('*')
          .gte('scheduled_at', new Date().toISOString())
          .order('scheduled_at', { ascending: true });

        if (error) {
          console.error('Failed to fetch scheduled sessions:', error);
          return;
        }

        set({ scheduledSessions: (data ?? []) as ScheduledSession[] });
      },

      setLocalNotificationId: (scheduleId, notificationId) => {
        set((s) => ({
          scheduledSessions: s.scheduledSessions.map((ss) =>
            ss.id === scheduleId
              ? { ...ss, local_notification_id: notificationId }
              : ss,
          ),
        }));
      },
    }),
    {
      name: 'march-buddy-schedule',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
