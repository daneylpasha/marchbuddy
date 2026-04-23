import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../api/supabase';
import { useAuthStore } from '../store/authStore';
import { useCoachSetupStore } from '../store/coachSetupStore';
import { useRunProgressStore } from '../store/runProgressStore';
import { useScheduleStore } from '../store/scheduleStore';
import { useChatStore } from '../store/chatStore';

export const authService = {
  async signInWithGoogleOAuth(): Promise<{ success: boolean; error?: string }> {
    try {
      const redirectTo = 'marchbuddy://auth/callback';

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          // Force Google to show the account picker every time instead of
          // silently reusing whichever account is already signed in on the
          // device. Without this, a user who has multiple Gmail accounts
          // can't pick a different one — Google auto-picks the default
          // and returns a session for that email immediately. With
          // prompt=select_account, Google always asks "which account?"
          // so users can register with a second email, switch accounts, etc.
          queryParams: {
            prompt: 'select_account',
          },
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
        // Do NOT call authStore.setSession here. Supabase's own
        // onAuthStateChange listener (wired up in authStore.initialize) fires
        // SIGNED_IN on successful setSession and drives the unified resolver.
        // Calling setSession here in addition would spawn a second concurrent
        // resolver and race with the conflict-rollback flow for guests who
        // try to sign in to an already-registered email.
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
      // SAFETY GUARD: never overwrite an account that already has onboarding
      // data on the server. The primary caller (authStore.setSession) already
      // checks for this, but we double-check here in case this method is ever
      // called from another code path. Without this guard, signing in with
      // Google using a previously-registered email while local guest data
      // exists would upsert the new guest's answers on top of the user's
      // real account — silently corrupting their progress.
      const { data: existing, error: existingError } = await supabase
        .from('user_onboarding')
        .select('onboarding_completed_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (existingError) {
        // Loud error so missing-table / RLS issues are obvious in dev. The
        // user_onboarding table must exist in the project — run the
        // migration in supabase/migrations/*_user_onboarding_table.sql if
        // this fires with code "PGRST205" or "42P01" (table not found).
        console.error(
          '[syncLocalDataToSupabase] Pre-sync check FAILED — onboarding will NOT be saved to server. Error:',
          existingError,
        );
        return;
      }
      if (existing?.onboarding_completed_at) {
        console.log('Server already has onboarding data — skipping guest-data migration.');
        return;
      }

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

        if (onboardingError) {
          console.error(
            '[syncLocalDataToSupabase] FAILED to upsert user_onboarding — re-signin will not restore data. Error:',
            onboardingError,
          );
        } else {
          console.log('[syncLocalDataToSupabase] user_onboarding upsert OK for user', userId);
        }
      }

      const p = runProgressStore.progress;
      // Only upsert run_progress when the local store actually has meaningful
      // data to migrate. Otherwise we'd overwrite existing server data with
      // post-reset defaults.
      const hasLocalProgress = !!p && (
        (p.totalSessionsCompleted ?? 0) > 0 ||
        (p.currentLevel ?? 1) > 1 ||
        (p.totalDistanceKm ?? 0) > 0 ||
        (p.currentStreakDays ?? 0) > 0
      );
      if (hasLocalProgress) {
        const { error: progressError } = await supabase
          .from('user_run_progress')
          .upsert({
            user_id: userId,
            current_level: p.currentLevel ?? 1,
            sessions_at_current_level: p.sessionsAtCurrentLevel ?? 0,
            total_sessions_completed: p.totalSessionsCompleted ?? 0,
            total_distance_km: p.totalDistanceKm ?? 0,
            total_duration_minutes: p.totalDurationMinutes ?? 0,
            longest_run_minutes: p.longestRunMinutes ?? 0,
            current_streak_days: p.currentStreakDays ?? 0,
            best_streak_days: p.bestStreakDays ?? 0,
            last_session_date: p.lastSessionDate ?? null,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });

        if (progressError) console.error('Error syncing progress:', progressError);
      }

      // Sync guest scheduled sessions
      const scheduleStore = useScheduleStore.getState();
      const guestSessions = scheduleStore.scheduledSessions.filter(
        (s) => s.user_id === 'guest',
      );
      for (const session of guestSessions) {
        const { error: schedError } = await supabase
          .from('scheduled_sessions')
          .insert({
            user_id: userId,
            session_key: session.session_key,
            session_title: session.session_title,
            scheduled_at: session.scheduled_at,
            notified: session.notified,
          });
        if (schedError) console.error('Error syncing schedule:', schedError);
      }

      // Sync chat messages
      const chatStore = useChatStore.getState();
      if (chatStore.messages.length > 0) {
        for (const msg of chatStore.messages) {
          const { error: chatError } = await supabase
            .from('chat_messages')
            .insert({
              user_id: userId,
              role: msg.role,
              content: msg.content,
              image_url: msg.imageUri ?? null,
            });
          if (chatError) console.error('Error syncing chat message:', chatError);
        }
      }

      console.log('Local data synced to Supabase');
    } catch (error) {
      console.error('Error syncing data:', error);
    }
  },

  /**
   * Push the user's current run progress (level, streak, totals) to the
   * server's user_run_progress table. Call this after every session
   * completion / level increment so a sign-out → sign-in cycle restores the
   * user's training history. Without it, runs only live in AsyncStorage and
   * are wiped on sign-out — the next sign-in finds an empty server row and
   * the user appears to start from Level 1, 0 sessions completed.
   *
   * Safe for guests too: if there's no Supabase session we early-return
   * (guests can't write to user_run_progress because of RLS).
   */
  async pushRunProgress(): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return; // Guest or signed-out — skip

      const { useRunProgressStore } = require('../store/runProgressStore');
      const p = useRunProgressStore.getState().progress;
      if (!p) return;

      const { error } = await supabase
        .from('user_run_progress')
        .upsert(
          {
            user_id: session.user.id,
            current_level: p.currentLevel ?? 1,
            sessions_at_current_level: p.sessionsAtCurrentLevel ?? 0,
            total_sessions_completed: p.totalSessionsCompleted ?? 0,
            total_distance_km: p.totalDistanceKm ?? 0,
            total_duration_minutes: p.totalDurationMinutes ?? 0,
            longest_run_minutes: p.longestRunMinutes ?? 0,
            current_streak_days: p.currentStreakDays ?? 0,
            best_streak_days: p.bestStreakDays ?? 0,
            last_session_date: p.lastSessionDate ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );

      if (error) console.error('pushRunProgress upsert error:', error);
    } catch (err) {
      console.error('pushRunProgress failed:', err);
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
