import { supabase } from '../api/supabase';
import type { ChatContext, ChatMessage } from '../types/chat';

interface SendMessageParams {
  message: string;
  imageBase64?: string;
  context: ChatContext;
  recentMessages: ChatMessage[];
}

interface Adjustment {
  type: string;
  suggestedVariant: string;
}

interface ChatResponse {
  reply: string;
  shouldAdjustPlan?: boolean;
  adjustment?: Adjustment | null;
}

export const chatApi = {
  async sendMessage(params: SendMessageParams): Promise<ChatResponse> {
    const { message, imageBase64, context, recentMessages } = params;

    try {
      const { data, error } = await supabase.functions.invoke('coach-chat', {
        body: {
          message,
          imageBase64,
          context,
          conversationHistory: recentMessages.slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        },
      });

      if (error) throw error;
      return data as ChatResponse;
    } catch (error) {
      console.warn('Error sending chat message:', error);
      return {
        reply: "Sorry, I'm having trouble connecting right now. Try again in a moment?",
      };
    }
  },
};
