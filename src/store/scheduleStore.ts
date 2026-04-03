import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../api/supabase';

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

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set, get) => ({
      scheduledSessions: [],

      scheduleSession: async (sessionKey, title, scheduledAt) => {
        const { data, error } = await supabase.functions.invoke('schedule-session', {
          method: 'POST',
          body: {
            session_key: sessionKey,
            session_title: title,
            scheduled_at: scheduledAt.toISOString(),
          },
        });

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error ?? 'Failed to schedule');

        const row = data.data as ScheduledSession;
        set((s) => ({
          scheduledSessions: [...s.scheduledSessions, row],
        }));
        return row;
      },

      updateSchedule: async (id, sessionKey, title, scheduledAt) => {
        const { data, error } = await supabase.functions.invoke('schedule-session', {
          method: 'PUT',
          body: {
            id,
            session_key: sessionKey,
            session_title: title,
            scheduled_at: scheduledAt.toISOString(),
          },
        });

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error ?? 'Failed to update');

        const row = data.data as ScheduledSession;
        set((s) => ({
          scheduledSessions: s.scheduledSessions.map((ss) =>
            ss.id === id ? row : ss,
          ),
        }));
        return row;
      },

      cancelSchedule: async (id) => {
        const { error } = await supabase.functions.invoke('schedule-session', {
          method: 'DELETE',
          body: { id },
        });

        if (error) throw error;

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
