import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../api/supabase';
import { useAuthStore } from '../store/authStore';
import { useCoachSetupStore } from '../store/coachSetupStore';
import { useRunProgressStore } from '../store/runProgressStore';

export const authService = {
  async signInWithGoogleOAuth(): Promise<{ success: boolean; error?: string }> {
    try {
      const redirectTo = 'marchbuddy://auth/callback';

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data.url) throw new Error('No URL returned from Supabase');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type !== 'success') {
        return { success: false, error: 'Sign in cancelled' };
      }

      const url = result.url;
      const fragment = url.includes('#') ? url.split('#')[1] : url.split('?')[1];
      const params = new URLSearchParams(fragment || '');

      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (!accessToken || !refreshToken) {
        return { success: false, error: 'No tokens in redirect URL' };
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (sessionError) throw sessionError;

      if (sessionData.session) {
        useAuthStore.getState().setSession(sessionData.session);
        await this.syncLocalDataToSupabase(sessionData.session.user.id);
        return { success: true };
      }

      return { success: false, error: 'No session returned' };
    } catch (error: any) {
      console.error('Google OAuth error:', error);
      return { success: false, error: error.message };
    }
  },

  async syncLocalDataToSupabase(userId: string): Promise<void> {
    try {
      const coachSetupStore = useCoachSetupStore.getState();
      const runProgressStore = useRunProgressStore.getState();

      if (coachSetupStore.setupComplete && coachSetupStore.setupData) {
        const d = coachSetupStore.setupData;
        const { error: onboardingError } = await supabase
          .from('user_onboarding')
          .upsert({
            user_id: userId,
            user_name: d.userName,
            activity_level: d.activityLevel,
            preferred_time: d.timePreference,
            trigger_statement: d.triggerStatement,
            past_failure_reason: d.pastFailureReason,
            primary_fear: d.primaryFear,
            practical_obstacles: d.obstacles,
            anchor_person: d.anchorPerson,
            success_vision: d.successVision,
            start_preference: d.preferredStartDate,
            onboarding_completed_at: d.completedAt,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });

        if (onboardingError) console.error('Error syncing onboarding:', onboardingError);
      }

      const p = runProgressStore.progress;
      const { error: progressError } = await supabase
        .from('user_run_progress')
        .upsert({
          user_id: userId,
          current_level: p?.currentLevel ?? 1,
          sessions_at_current_level: p?.sessionsAtCurrentLevel ?? 0,
          total_sessions_completed: p?.totalSessionsCompleted ?? 0,
          total_distance_km: p?.totalDistanceKm ?? 0,
          total_duration_minutes: p?.totalDurationMinutes ?? 0,
          longest_run_minutes: p?.longestRunMinutes ?? 0,
          current_streak_days: p?.currentStreakDays ?? 0,
          best_streak_days: p?.bestStreakDays ?? 0,
          last_session_date: p?.lastSessionDate ?? null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (progressError) console.error('Error syncing progress:', progressError);

      console.log('Local data synced to Supabase');
    } catch (error) {
      console.error('Error syncing data:', error);
    }
  },

  async restoreSession(): Promise<boolean> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (session) {
        useAuthStore.getState().setSession(session);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error restoring session:', error);
      return false;
    }
  },

  async signOut(): Promise<void> {
    try {
      await supabase.auth.signOut();
      useAuthStore.getState().logout();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  },
};
