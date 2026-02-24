import { supabase } from '../api/supabase';
import { SessionOptions, SessionPlan, UserProgress, CompletedSession } from '../types/session';
import { getLevelDefinition, generateSessionPlan } from '../constants/sessionTemplates';

// ─── Process Completed Session ────────────────────────────────────────────────

interface ProcessSessionParams {
  sessionData: CompletedSession;
  onboardingData: {
    userName: string;
    triggerStatement?: string;
    anchorPerson?: string;
    primaryFear?: string;
    successVision?: string;
  };
}

export interface ProcessSessionResponse {
  sessionId: string;
  coachFeedback: string;
  progressUpdate: {
    newLevel: number;
    leveledUp: boolean;
    totalSessions: number;
    currentStreak: number;
    milestoneReached: string | null;
  };
}

interface OnboardingData {
  userName: string;
  triggerStatement?: string;
  anchorPerson?: string;
  primaryFear?: string;
  successVision?: string;
}

interface GenerateOptionsParams {
  progress: UserProgress;
  onboardingData: OnboardingData;
  recentFeedback?: string[];
}

interface GenerateOptionsResponse {
  coachMessage: string;
  recommendedVariant: 'recommended' | 'quick' | 'challenge' | 'push';
  adjustmentReason?: string;
}

export const sessionApi = {
  async generateTodayOptions(params: GenerateOptionsParams): Promise<SessionOptions> {
    const { progress, onboardingData, recentFeedback } = params;

    const levelDef = getLevelDefinition(progress.currentLevel);
    if (!levelDef) {
      throw new Error(`Invalid level: ${progress.currentLevel}`);
    }

    let aiResponse: GenerateOptionsResponse;

    try {
      const { data, error } = await supabase.functions.invoke('generate-session-options', {
        body: {
          userId: progress.userId,
          currentLevel: progress.currentLevel,
          sessionsAtCurrentLevel: progress.sessionsAtCurrentLevel,
          totalSessionsCompleted: progress.totalSessionsCompleted,
          lastSessionDate: progress.lastSessionDate,
          currentStreakDays: progress.currentStreakDays,
          sessionsThisWeek: progress.sessionsThisWeek,
          recentFeedback,
          onboardingData,
        },
      });

      if (error) throw error;
      aiResponse = data as GenerateOptionsResponse;
    } catch (error) {
      console.warn('generate-session-options unavailable, using fallback:', error);
      aiResponse = {
        coachMessage: `Ready when you are, ${onboardingData.userName}. Today's session is waiting.`,
        recommendedVariant: 'recommended',
      };
    }

    const templates = {
      recommended: levelDef.recommendedTemplate,
      quick: levelDef.quickTemplate,
      challenge: levelDef.challengeTemplate,
      push: levelDef.pushTemplate,
    };

    const recommendedPlan = generateSessionPlan(
      templates[aiResponse.recommendedVariant],
      progress.currentLevel,
    );
    recommendedPlan.isRecommended = true;

    const alternativeVariants = (['recommended', 'quick', 'challenge', 'push'] as const).filter(
      (v) => v !== aiResponse.recommendedVariant,
    );

    const alternatives = alternativeVariants.map((variant) => {
      const plan = generateSessionPlan(templates[variant], progress.currentLevel);
      plan.isRecommended = false;
      return plan;
    });

    return {
      recommended: recommendedPlan,
      alternatives,
      coachMessage: aiResponse.coachMessage,
      generatedAt: new Date().toISOString(),
    };
  },

  getSessionPlan(
    level: number,
    variant: 'recommended' | 'quick' | 'challenge' | 'push',
  ): SessionPlan | null {
    const levelDef = getLevelDefinition(level);
    if (!levelDef) return null;

    const templates = {
      recommended: levelDef.recommendedTemplate,
      quick: levelDef.quickTemplate,
      challenge: levelDef.challengeTemplate,
      push: levelDef.pushTemplate,
    };

    return generateSessionPlan(templates[variant], level);
  },

  processCompletedSession(params: ProcessSessionParams): ProcessSessionResponse {
    const { sessionData, onboardingData } = params;
    const name = onboardingData.userName || 'there';
    const mins = Math.round(sessionData.actualDurationMinutes);
    const rating = sessionData.feedbackRating;

    let coachFeedback: string;

    if (sessionData.endedEarly) {
      coachFeedback = `Stopping when you need to is smart, ${name}. Those ${mins} minutes still count — every session builds the foundation.`;
    } else {
      const messages: Record<string, string[]> = {
        too_easy: [
          `You made that look easy, ${name}. ${mins} minutes done — next session we push the pace a bit more.`,
          `Cruised through it, ${name}. That's a sign your fitness is building. Time to step it up.`,
          `Strong work, ${name}. When a session feels easy, it means you're getting stronger.`,
        ],
        just_right: [
          `That's the sweet spot, ${name}. ${mins} minutes at the right intensity — this is exactly how progress happens.`,
          `Perfect effort, ${name}. Sessions that feel just right are where real adaptation happens.`,
          `Dialled in, ${name}. ${mins} minutes of quality work. Stay consistent and the results will come.`,
        ],
        challenging: [
          `Tough session, ${name} — and you finished it. That's what separates people who get fit from those who don't.`,
          `${mins} minutes of real work, ${name}. The hard sessions build the most strength.`,
          `That one took something extra, ${name}. Good. Showing up when it's hard is the whole game.`,
        ],
        too_hard: [
          `Every session counts, ${name}, even the hard ones. Your body will adapt — we'll find the right pace.`,
          `Honest effort, ${name}. Some days are tougher than others. Showing up is still a win.`,
          `You got through it, ${name}. That matters more than how it felt. Rest up and come back strong.`,
        ],
      };

      const pool = messages[rating ?? 'just_right'] ?? messages['just_right'];
      // Pick a message based on a hash of the session id for variety
      const idx = sessionData.id.charCodeAt(0) % pool.length;
      coachFeedback = pool[idx];
    }

    // Milestone override
    if (onboardingData.triggerStatement) {
      const sessionNum = Math.floor(Math.random() * 10);
      if (sessionNum === 0) {
        coachFeedback += ` Remember why you started: "${onboardingData.triggerStatement}"`;
      }
    }

    return {
      sessionId: sessionData.id,
      coachFeedback,
      progressUpdate: {
        newLevel: sessionData.planLevel,
        leveledUp: false,
        totalSessions: 1,
        currentStreak: 1,
        milestoneReached: null,
      },
    };
  },

  async getRecentSessions(limit = 10): Promise<unknown[]> {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching sessions:', error);
      return [];
    }

    return data ?? [];
  },

  async getRecentFeedback(limit = 3): Promise<string[]> {
    const { data, error } = await supabase
      .from('sessions')
      .select('feedback_rating')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return data.map((s) => s.feedback_rating).filter(Boolean);
  },
};
