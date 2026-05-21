import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChatMessage } from '../types/chat';
import { fetchProactiveCoachMessages } from '../services/proactiveCoachApi';
import { supabase } from '../api/supabase';
import { analytics, EVENTS } from '../services/analytics';

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  hasUnread: boolean;
  // High-water mark for incremental proactive-message sync.
  lastProactiveSyncAt: string | null;

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

      markAsRead: () => set({ hasUnread: false }),

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
            // Still bump the watermark if the server gave us a new one
            // (no new messages, but ack the sync).
            if (result.latestSentAt && result.latestSentAt !== state.lastProactiveSyncAt) {
              set({ lastProactiveSyncAt: result.latestSentAt });
            }
            return 0;
          }

          const existingIds = new Set(state.messages.map((m) => m.serverScheduleId).filter(Boolean));
          const novel = result.messages.filter(
            (m) => !m.serverScheduleId || !existingIds.has(m.serverScheduleId),
          );

          if (novel.length === 0) {
            if (result.latestSentAt) {
              set({ lastProactiveSyncAt: result.latestSentAt });
            }
            return 0;
          }

          set((s) => ({
            messages: [...s.messages, ...novel],
            hasUnread: true,
            lastProactiveSyncAt: result.latestSentAt ?? s.lastProactiveSyncAt,
          }));

          // Fire `coach_message_opened` for each as soon as it lands in the
          // user's local chat — the spec defines this as "user opened Coach
          // tab within 1h of send". This timing approximation is close
          // enough for V2; we can tighten later if needed.
          for (const m of novel) {
            if (m.proactiveTrigger && m.serverScheduleId) {
              analytics.track(EVENTS.coach_message_opened, {
                trigger_type: m.proactiveTrigger,
                schedule_id: m.serverScheduleId,
              });
            }
          }

          return novel.length;
        } catch (e) {
          console.warn('syncProactiveMessages failed:', e);
          return 0;
        }
      },
    }),
    {
      name: 'march-buddy-chat',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
