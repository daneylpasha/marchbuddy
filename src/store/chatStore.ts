import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChatMessage } from '../types/chat';

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  hasUnread: boolean;

  addMessage: (message: ChatMessage) => void;
  addCoachMessage: (content: string) => void;
  addUserMessage: (content: string, imageUri?: string) => void;
  addSystemMessage: (content: string) => void;
  setLoading: (loading: boolean) => void;
  markAsRead: () => void;
  clearChat: () => void;
  initializeChat: (userName: string) => void;
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
    }),
    {
      name: 'march-buddy-chat',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
