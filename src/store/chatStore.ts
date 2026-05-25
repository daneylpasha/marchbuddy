import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChatMessage } from '../types/chat';
import { fetchProactiveCoachMessages } from '../services/proactiveCoachApi';
import { supabase } from '../api/supabase';
import { analytics, EVENTS } from '../services/analytics';

// Per-pending-open record. Holds the bare minimum needed to fire
// `coach_message_opened` when the user actually focuses the Coach tab
// (not when the message is silently fetched in the background).
interface PendingOpenedEvent {
  scheduleId: string;
  triggerType: string;
  fetchedAt: number; // epoch ms — used to compute "delay from send to view"
}

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  hasUnread: boolean;
  // High-water mark for incremental proactive-message sync.
  lastProactiveSyncAt: string | null;
  // Proactive messages that have been fetched but the user hasn't actually
  // viewed yet. Drained by markAsRead() (which fires when Coach tab focuses).
  pendingOpenedEvents: PendingOpenedEvent[];

  addMessage: (message: ChatMessage) => void;
  addCoachMessage: (content: string) => void;
  addUserMessage: (content: string, imageUri?: string) => void;
  addSystemMessage: (content: string) => void;
  setLoading: (loading: boolean) => void;
  markAsRead: () => void;
  clearChat: () => void;
  initializeChat: (userName: string) => void;
  // Pull any proactive coach messages the server has generated since the
  // last sync. Idempotent — calling repeatedly is safe.
  syncProactiveMessages: () => Promise<number>;
}

// Guard against concurrent syncs (mount + focus + appstate can all fire
// at once). Without this, two in-flight fetches each see the same stale
// `existingIds` snapshot and both append the same rows, producing duplicate
// React keys (`proactive-<uuid>`).
let proactiveSyncInFlight: Promise<number> | null = null;

const createWelcomeMessage = (userName: string): ChatMessage => ({
  id: 'welcome',
  role: 'coach',
  type: 'text',
  content: `Hey ${userName}! I'm here whenever you need me. Tell me how you're feeling, share what's going on in your life, or just check in. I'll help adjust your training around whatever you're dealing with.\n\nWhat's on your mind?`,
  timestamp: new Date().toISOString(),
});

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      isLoading: false,
      hasUnread: false,
      lastProactiveSyncAt: null,
      pendingOpenedEvents: [],

      addMessage: (message) => {
        set((state) => ({
          messages: [...state.messages, message],
          hasUnread: message.role === 'coach' ? true : state.hasUnread,
        }));
      },

      addUserMessage: (content, imageUri) => {
        const message: ChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          type: imageUri ? 'image' : 'text',
          content,
          imageUri,
          timestamp: new Date().toISOString(),
        };
        get().addMessage(message);
      },

      addCoachMessage: (content) => {
        const message: ChatMessage = {
          id: `coach-${Date.now()}`,
          role: 'coach',
          type: 'text',
          content,
          timestamp: new Date().toISOString(),
        };
        get().addMessage(message);
      },

      addSystemMessage: (content) => {
        const message: ChatMessage = {
          id: `system-${Date.now()}`,
          role: 'system',
          type: 'text',
          content,
          timestamp: new Date().toISOString(),
        };
        set((state) => ({ messages: [...state.messages, message] }));
      },

      setLoading: (loading) => set({ isLoading: loading }),

      markAsRead: () => {
        // Drain any queued proactive messages and fire `coach_message_opened`
        // for each ONE TIME, only when the user actually views the tab.
        // This is the correct semantic for the spec metric ("user opened
        // Coach tab within 1 hour of send") — firing on silent fetch would
        // inflate the metric.
        const queue = get().pendingOpenedEvents;
        if (queue.length > 0) {
          for (const ev of queue) {
            analytics.track(EVENTS.coach_message_opened, {
              trigger_type: ev.triggerType,
              schedule_id: ev.scheduleId,
              latency_ms: Date.now() - ev.fetchedAt,
            });
          }
          set({ hasUnread: false, pendingOpenedEvents: [] });
          return;
        }
        set({ hasUnread: false });
      },

      clearChat: () => set({ messages: [], hasUnread: false }),

      initializeChat: (userName) => {
        const { messages } = get();
        if (messages.length === 0) {
          set({ messages: [createWelcomeMessage(userName)] });
        }
      },

      // Pulls any new server-generated coach messages and appends them.
      // De-dup by serverScheduleId so re-syncs are no-ops.
      // Returns the number of NEW messages added.
      syncProactiveMessages: async () => {
        // Coalesce concurrent callers onto a single fetch so mount + focus +
        // appstate firing together don't double-append the same rows.
        if (proactiveSyncInFlight) return proactiveSyncInFlight;

        proactiveSyncInFlight = (async () => {
          try {
            const { data: authData } = await supabase.auth.getUser();
            const userId = authData?.user?.id;
            if (!userId) return 0;

            const state = get();
            const result = await fetchProactiveCoachMessages(
              userId,
              state.lastProactiveSyncAt,
            );
            if (result.messages.length === 0) {
              if (result.latestSentAt && result.latestSentAt !== state.lastProactiveSyncAt) {
                set({ lastProactiveSyncAt: result.latestSentAt });
              }
              return 0;
            }

            const now = Date.now();
            let appendedCount = 0;

            // Dedup at write time against the freshest store state so any
            // parallel mutation (e.g. a user message added mid-fetch, or
            // another sync that already appended) can't produce duplicate ids.
            set((s) => {
              const existingIds = new Set(
                s.messages.map((m) => m.serverScheduleId).filter(Boolean),
              );
              const novel = result.messages.filter(
                (m) => m.serverScheduleId && !existingIds.has(m.serverScheduleId),
              );
              if (novel.length === 0) {
                return {
                  lastProactiveSyncAt: result.latestSentAt ?? s.lastProactiveSyncAt,
                };
              }
              appendedCount = novel.length;
              const newPending: PendingOpenedEvent[] = novel
                .filter((m) => m.proactiveTrigger && m.serverScheduleId)
                .map((m) => ({
                  scheduleId: m.serverScheduleId!,
                  triggerType: m.proactiveTrigger!,
                  fetchedAt: now,
                }));
              return {
                messages: [...s.messages, ...novel],
                hasUnread: true,
                lastProactiveSyncAt: result.latestSentAt ?? s.lastProactiveSyncAt,
                pendingOpenedEvents: [...s.pendingOpenedEvents, ...newPending],
              };
            });

            return appendedCount;
          } catch (e) {
            console.warn('syncProactiveMessages failed:', e);
            return 0;
          } finally {
            proactiveSyncInFlight = null;
          }
        })();

        return proactiveSyncInFlight;
      },
    }),
    {
      name: 'march-buddy-chat',
      storage: createJSONStorage(() => AsyncStorage),
      // Drop any duplicate ids that may have been written by an earlier
      // racing-sync bug. Keeps the first occurrence so React's keyExtractor
      // sees a unique set on app start.
      onRehydrateStorage: () => (state) => {
        if (!state || !Array.isArray(state.messages)) return;
        const seen = new Set<string>();
        const deduped: ChatMessage[] = [];
        for (const m of state.messages) {
          if (seen.has(m.id)) continue;
          seen.add(m.id);
          deduped.push(m);
        }
        if (deduped.length !== state.messages.length) {
          state.messages = deduped;
        }
      },
    },
  ),
);
