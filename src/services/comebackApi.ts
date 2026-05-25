import { supabase } from '../api/supabase';
import { ComebackContext, ComebackDecision } from '../types/comeback';

export const comebackApi = {
  /**
   * Get AI recommendation for what level to restart at after a gap.
   */
  async getRecommendation(context: ComebackContext): Promise<ComebackDecision> {
    try {
      const { data, error } = await supabase.functions.invoke('comeback-decision', {
        body: context,
      });

      // Edge function returns 503 when the AI is unavailable. Keep user at
      // their current level and surface a friendly notice — never silently drop.
      if (error || data?.error) {
        return this.getAiUnavailableDecision(context);
      }

      return data as ComebackDecision;
    } catch {
      return this.getAiUnavailableDecision(context);
    }
  },

  // Called when the AI edge function is unreachable or errored. Keeps the
  // user at their previous level — no surprise demotion.
  getAiUnavailableDecision(context: ComebackContext): ComebackDecision {
    return {
      recommendedLevel: context.previousLevel,
      reasoning: '',
      encouragement: '',
      suggestFitnessCheck: false,
      isAiUnavailable: true,
    };
  },

  /**
   * Fallback recommendation if the AI edge function is unavailable.
   */
  getFallbackRecommendation(context: ComebackContext): ComebackDecision {
    const { daysSinceLastSession, previousLevel, fitnessFeeling } = context;

    let levelDrop = 0;

    if (daysSinceLastSession > 60) {
      levelDrop = 4;
    } else if (daysSinceLastSession > 30) {
      levelDrop = 3;
    } else if (daysSinceLastSession > 14) {
      levelDrop = 2;
    } else if (daysSinceLastSession > 7) {
      levelDrop = 1;
    }

    if (fitnessFeeling === 'too_easy') {
      levelDrop = Math.max(0, levelDrop - 1);
    } else if (fitnessFeeling === 'too_hard') {
      levelDrop = levelDrop + 1;
    }

    const recommendedLevel = Math.max(1, previousLevel - levelDrop);

    return {
      recommendedLevel,
      reasoning: `Based on your ${daysSinceLastSession}-day break, Level ${recommendedLevel} will help you ease back in safely.`,
      encouragement: `Welcome back, ${context.userName}! Let's rebuild that momentum together.`,
      suggestFitnessCheck: false,
    };
  },
};
