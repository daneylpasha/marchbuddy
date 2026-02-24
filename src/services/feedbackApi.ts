import { supabase } from '../api/supabase';

export const feedbackApi = {
  /**
   * Write post-session feedback to DB. Fire-and-forget — never blocks the user.
   */
  async submitSessionFeedback(data: {
    userId: string;
    sessionId: string;
    difficultyRating: string;
    comment?: string | null;
    currentLevel: number;
    sessionType: string;
  }): Promise<void> {
    const { error } = await supabase.from('session_feedback').insert({
      user_id: data.userId,
      session_id: data.sessionId,
      difficulty_rating: data.difficultyRating,
      comment: data.comment ?? null,
      current_level: data.currentLevel,
      session_type: data.sessionType,
    });
    if (error) {
      console.warn('[feedbackApi] session_feedback insert failed:', error.message);
    }
  },

  /**
   * Record how the user responded to the in-app rating nudge.
   */
  async submitAppRatingPrompt(data: {
    userId: string;
    response: 'loved_it' | 'could_be_better' | 'dismissed';
    sessionsAtPrompt: number;
  }): Promise<void> {
    const { error } = await supabase.from('app_rating_prompts').insert({
      user_id: data.userId,
      response: data.response,
      sessions_at_prompt: data.sessionsAtPrompt,
    });
    if (error) {
      console.warn('[feedbackApi] app_rating_prompts insert failed:', error.message);
    }
  },

  /**
   * Submit a full feedback form entry from the Settings screen.
   * Throws on failure so the caller can show an error to the user.
   */
  async submitUserFeedback(data: {
    userId: string;
    category: string;
    message: string;
    appVersion: string;
    devicePlatform: string;
    currentLevel: number;
    sessionsCount: number;
  }): Promise<void> {
    const { error } = await supabase.from('user_feedback').insert({
      user_id: data.userId,
      category: data.category,
      message: data.message,
      app_version: data.appVersion,
      device_platform: data.devicePlatform,
      current_level: data.currentLevel,
      sessions_count: data.sessionsCount,
    });
    if (error) {
      throw new Error(error.message);
    }
  },
};
