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
  // Reentrancy guard for syncProactiveMessages. Multiple call sites can fire
  // sync at the same time (useEffect + useFocusEffect + AppState listener
  // all trigger on app open) — without this flag they race and we end up
  // with duplicate messages appended to chat.
  isSyncingProactive: boolean;

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
      pendingOpenedEvents: [],
      isSyncingProactive: false,

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
          return;
        }
        // Self-heal: prior versions had a race that could duplicate proactive
        // coach messages in AsyncStorage. On mount, collapse duplicates by
        // serverScheduleId (keep first occurrence). One-time cost; no-op once
        // the persisted state is clean.
        const seen = new Set<string>();
        const deduped: ChatMessage[] = [];
        let removed = 0;
        for (const m of messages) {
          if (m.serverScheduleId) {
            if (seen.has(m.serverScheduleId)) {
              removed++;
              continue;
            }
            seen.add(m.serverScheduleId);
          }
          deduped.push(m);
        }
        if (removed > 0) {
          console.warn(`[chatStore] removed ${removed} duplicate proactive message(s) from persisted state`);
          set({ messages: deduped });
        }
      },

      // Pulls any new server-generated coach messages and appends them.
      // De-dup by serverScheduleId so re-syncs are no-ops.
      // Returns the number of NEW messages added.
      //
      // CONCURRENCY: this function can be called from multiple places on
      // app open (useEffect mount + useFocusEffect + AppState 'active').
      // We use an isSyncingProactive guard + an atomic in-set dedup so
      // overlapping calls never produce duplicate chat entries.
      syncProactiveMessages: async () => {
        // Guard: if another sync is already in flight, skip. The in-flight
        // one will pick up everything pending; running a duplicate fetch
        // just wastes a network round-trip and risks racing on the dedup.
        if (get().isSyncingProactive) return 0;
        set({ isSyncingProactive: true });

        try {
          const { data: authData } = await supabase.auth.getUser();
          const userId = authData?.user?.id;
          if (!userId) return 0;

          const result = await fetchProactiveCoachMessages(
            userId,
            get().lastProactiveSyncAt,
          );

          if (result.messages.length === 0) {
            // Still bump the watermark if the server gave us a new one
            // (no new messages, but ack the sync).
            if (result.latestSentAt) {
              set((s) =>
                result.latestSentAt && result.latestSentAt !== s.lastProactiveSyncAt
                  ? { lastProactiveSyncAt: result.latestSentAt }
                  : {},
              );
            }
            return 0;
          }

          // Snapshot a few values from the fetch result so we can compute
          // them once here, then do the actual dedup ATOMICALLY inside the
          // set() callback below. Doing dedup against `get().messages`
          // outside the set callback would race with a concurrent sync
          // (or any other store mutation) and re-introduce duplicates.
          const now = Date.now();
          const fetchedLatest = result.latestSentAt;
          const fetched = result.messages;

          let addedCount = 0;
          set((s) => {
            const existingIds = new Set(
              s.messages.map((m) => m.serverScheduleId).filter(Boolean),
            );
            const novel = fetched.filter(
              (m) => !m.serverScheduleId || !existingIds.has(m.serverScheduleId),
            );
            addedCount = novel.length;

            if (novel.length === 0) {
              return fetchedLatest && fetchedLatest !== s.lastProactiveSyncAt
                ? { lastProactiveSyncAt: fetchedLatest }
                : {};
            }

            // Queue these messages for `coach_message_opened` tracking —
            // we only fire that event when the user actually focuses the
            // Coach tab (handled in markAsRead). Fetching silently in the
            // background should NOT count as "opened".
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
              lastProactiveSyncAt: fetchedLatest ?? s.lastProactiveSyncAt,
              pendingOpenedEvents: [...s.pendingOpenedEvents, ...newPending],
            };
          });

          return addedCount;
        } catch (e) {
          console.warn('syncProactiveMessages failed:', e);
          return 0;
        } finally {
          set({ isSyncingProactive: false });
        }
      },
    }),
    {
      name: 'march-buddy-chat',
      storage: createJSONStorage(() => AsyncStorage),
      // Exclude transient/in-flight state from persistence.
      //
      // Without this, a crash or force-quit mid-sync would persist
      // `isSyncingProactive: true`, and on next launch the rehydrated
      // state would block ALL future syncProactiveMessages calls forever
      // (the reentrancy guard would think a sync is still in flight).
      //
      // `pendingOpenedEvents` IS persisted intentionally: if the user
      // received a proactive message, then closed the app before
      // focusing the Coach tab, the `coach_message_opened` event should
      // still fire when they finally view it on the next session.
      partialize: (state) => ({
        messages: state.messages,
        hasUnread: state.hasUnread,
        lastProactiveSyncAt: state.lastProactiveSyncAt,
        pendingOpenedEvents: state.pendingOpenedEvents,
        // Deliberately NOT persisted:
        //   - isLoading (typing indicator must never survive restart)
        //   - isSyncingProactive (reentrancy guard, must reset each session)
      }),
    },
  ),
);
