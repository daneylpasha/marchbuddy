import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { FeedbackRating, CompletedSession } from '../../types/session';
import { sessionApi } from '../../services/sessionApi';
import { feedbackApi } from '../../services/feedbackApi';
import { logSessionCompletion } from '../../services/notifications/completionLogger';
import { updateProgressAfterOutdoorSession } from '../../services/challengeService';
import healthService from '../../services/health';
import { detectMilestone } from '../../constants/milestones';
import { useCoachSetupStore } from '../../store/coachSetupStore';
import { useRunProgressStore } from '../../store/runProgressStore';
import { useSessionStore } from '../../store/sessionStore';
import { SessionSummaryCard } from './components/SessionSummaryCard';
import { FeedbackSelector } from './components/FeedbackSelector';
import { RouteMap } from '../../components/session/RouteMap';
import { calibrateFromFirstSession } from '../../utils/levelPlacement';
import { colors, fonts, spacing } from '../../theme';
import type { RunStackParamList } from '../../navigation/RunNavigator';

type Props = NativeStackScreenProps<RunStackParamList, 'PostSession'>;

export default function PostSessionScreen({ navigation, route }: Props) {
  const { session } = route.params;

  const { setupData, guestId } = useCoachSetupStore();
  const { updateAfterSession, incrementLevel, addToHistory } = useRunProgressStore();
  const { clearTodayOptions } = useSessionStore();

  const isIndoor = session.environment === 'indoor';

  const [feedbackRating, setFeedbackRating] = useState<FeedbackRating | null>(null);
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [treadmillDistance, setTreadmillDistance] = useState('');
  const [treadmillSteps, setTreadmillSteps] = useState('');
  const [treadmillCalories, setTreadmillCalories] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (shareAfter: boolean) => {
    if (!feedbackRating) return;

    setIsSubmitting(true);

    const treadmillStats =
      isIndoor && (treadmillDistance || treadmillSteps || treadmillCalories)
        ? {
            distanceKm: treadmillDistance ? parseFloat(treadmillDistance) : undefined,
            steps: treadmillSteps ? parseInt(treadmillSteps, 10) : undefined,
            calories: treadmillCalories ? parseInt(treadmillCalories, 10) : undefined,
          }
        : null;

    const updatedSession: CompletedSession = {
      ...session,
      feedbackRating,
      feedbackNotes: feedbackNotes.trim() || null,
      treadmillStats,
    };

    const onboardingData = {
      userName: setupData.userName || 'there',
      triggerStatement: setupData.triggerStatement,
      anchorPerson: setupData.anchorPerson,
      primaryFear: setupData.primaryFear,
      successVision: setupData.successVision,
    };

    // Snapshot distance BEFORE updating so detectMilestone can check crossings
    const prevDistanceKm = useRunProgressStore.getState().progress?.totalDistanceKm ?? 0;
    // Snapshot whether this is the user's first completed session BEFORE
    // updateAfterSession bumps the count. Used below to fire one-time
    // first-session level calibration based on the user's feedback.
    const wasFirstSession =
      (useRunProgressStore.getState().progress?.totalSessionsCompleted ?? 0) === 0;

    // Fire-and-forget side effects — never block the user
    if (guestId && feedbackRating) {
      feedbackApi
        .submitSessionFeedback({
          userId: guestId,
          sessionId: session.id,
          difficultyRating: feedbackRating,
          comment: feedbackNotes.trim() || null,
          currentLevel: session.planLevel,
          sessionType: session.planVariant,
        })
        .catch(() => {});
    }
    void logSessionCompletion({
      sessionKey: session.planId,
      sessionTitle: session.planTitle,
      completedAt: new Date(session.completedAt),
    });

    // Prefer treadmill-reported distance for indoor sessions; fall back to GPS.
    const effectiveDistanceKm =
      isIndoor && treadmillStats?.distanceKm != null
        ? treadmillStats.distanceKm
        : session.actualDistanceKm;

    // Always update local store so the UI stays responsive
    updateAfterSession({
      durationMinutes: session.actualDurationMinutes,
      distanceKm: effectiveDistanceKm,
    });
    // Persist a downsampled route alongside summary fields so the past-
    // session detail screen can render the map offline. Cap at ~400 points
    // to keep AsyncStorage bounded — at 1 fix / 5s that's ~33 minutes of
    // raw data; longer sessions get evenly-spaced subsampling, which is
    // plenty of resolution for a static preview.
    const MAX_ROUTE_POINTS = 400;
    let storedRoute: typeof session.route | undefined = undefined;
    if (!isIndoor && session.route && session.route.length >= 2) {
      if (session.route.length <= MAX_ROUTE_POINTS) {
        storedRoute = session.route;
      } else {
        const stride = session.route.length / MAX_ROUTE_POINTS;
        const sampled: typeof session.route = [];
        for (let i = 0; i < MAX_ROUTE_POINTS; i++) {
          sampled.push(session.route[Math.floor(i * stride)]);
        }
        // Always preserve the true endpoint for accurate end marker placement.
        sampled[sampled.length - 1] = session.route[session.route.length - 1];
        storedRoute = sampled;
      }
    }

    addToHistory({
      id: session.id,
      date: session.completedAt.split('T')[0],
      durationMinutes: session.actualDurationMinutes,
      distanceKm: effectiveDistanceKm,
      planTitle: session.planTitle,
      planLevel: session.planLevel,
      feedbackRating: feedbackRating,
      endedEarly: session.endedEarly,
      route: storedRoute,
      environment: session.environment,
    });

    // Update challenge progress for outdoor sessions (fire-and-forget)
    if (!isIndoor) {
      updateProgressAfterOutdoorSession({
        durationMinutes: session.actualDurationMinutes,
      }).catch(() => {});
    }

    // Fire-and-forget — never block the user on platform health write.
    // iOS: saves HKWorkout + distance to Apple Health (closes Activity ring).
    // Android: no-op stub until Health Connect is wired up.
    healthService
      .saveWorkout({
        startDate: new Date(session.startedAt),
        endDate: new Date(session.completedAt),
        durationMinutes: session.actualDurationMinutes,
        distanceKm: effectiveDistanceKm,
        workoutType: session.planLevel >= 9 ? 'running' : 'walking',
      })
      .catch(() => {});

    try {
      // Primary path: Edge Function saves session to DB, computes progress,
      // returns real AI coach feedback. Awaiting this is intentional — the
      // loading state covers the wait and the user gets genuine feedback.
      const result = await sessionApi.processCompletedSessionOnServer({
        sessionData: updatedSession,
        onboardingData,
      });

      // Sync local level from server result
      if (result.progressUpdate.leveledUp) incrementLevel();

      // First-session calibration: server doesn't know about this concept,
      // so we apply it client-side after syncing the server's level. Only
      // fires if it's session #1 AND feedback indicates a misplacement.
      let calibration: { previousLevel: number; newLevel: number; reason: string } | undefined;
      let progressUpdate = result.progressUpdate;
      if (wasFirstSession && feedbackRating) {
        const currentLevel = useRunProgressStore.getState().progress?.currentLevel ?? progressUpdate.newLevel;
        const calib = calibrateFromFirstSession(currentLevel, feedbackRating);
        if (calib.delta !== 0) {
          useRunProgressStore.getState().setLevel(calib.newLevel);
          calibration = { previousLevel: calib.previousLevel, newLevel: calib.newLevel, reason: calib.reason };
          progressUpdate = { ...progressUpdate, newLevel: calib.newLevel };
        }
      }

      clearTodayOptions();
      // Edge Function persists user_run_progress and sessions, but the public
      // `profiles` table (used by Bench March / community) is not touched there.
      // Push community-visible fields so other users see fresh stats.
      const { authService } = require('../../services/authService');
      authService.pushRunProgress().catch(() => {});

      const milestoneId = progressUpdate.milestoneReached;

      if (milestoneId) {
        navigation.replace('Celebration', {
          milestoneId,
          coachFeedback: result.coachFeedback,
          progressUpdate,
          session: updatedSession,
          shareAfter,
        });
      } else {
        navigation.replace('CoachFeedback', {
          coachFeedback: result.coachFeedback,
          progressUpdate,
          session: updatedSession,
          shareAfter,
          calibration,
        });
      }
    } catch (err) {
      // Fallback: Edge Function unavailable — use local processing so the
      // user always advances regardless of network state.
      console.warn('process-session-feedback unavailable, using local fallback:', err);

      const result = sessionApi.processCompletedSession({
        sessionData: updatedSession,
        onboardingData,
      });

      const freshProgress = useRunProgressStore.getState().progress;
      const leveledUp = !!(
        freshProgress &&
        freshProgress.sessionsAtCurrentLevel >= 3 &&
        freshProgress.currentLevel < 16
      );
      if (leveledUp) incrementLevel();

      clearTodayOptions();

      const { authService } = require('../../services/authService');
      authService.pushRunProgress().catch((pushErr: unknown) => {
        console.warn('Failed to push run progress to server:', pushErr);
      });

      const finalProgress = useRunProgressStore.getState().progress;
      let newLevel = finalProgress?.currentLevel ?? session.planLevel;

      // First-session calibration in the offline path mirrors the server-path
      // logic. Same one-shot rules apply.
      let calibration: { previousLevel: number; newLevel: number; reason: string } | undefined;
      if (wasFirstSession && feedbackRating) {
        const calib = calibrateFromFirstSession(newLevel, feedbackRating);
        if (calib.delta !== 0) {
          useRunProgressStore.getState().setLevel(calib.newLevel);
          calibration = { previousLevel: calib.previousLevel, newLevel: calib.newLevel, reason: calib.reason };
          newLevel = calib.newLevel;
        }
      }

      const milestoneId = freshProgress
        ? detectMilestone(prevDistanceKm, freshProgress, leveledUp, newLevel)
        : null;

      const progressUpdate = {
        newLevel,
        leveledUp,
        totalSessions: finalProgress?.totalSessionsCompleted ?? 1,
        currentStreak: finalProgress?.currentStreakDays ?? 1,
        milestoneReached: milestoneId,
      };

      if (milestoneId) {
        navigation.replace('Celebration', {
          milestoneId,
          coachFeedback: result.coachFeedback,
          progressUpdate,
          session: updatedSession,
          shareAfter,
        });
      } else {
        navigation.replace('CoachFeedback', {
          coachFeedback: result.coachFeedback,
          progressUpdate,
          session: updatedSession,
          shareAfter,
          calibration,
        });
      }
    }
  };

  const treadmillDistanceMissing =
    isIndoor && (!treadmillDistance.trim() || parseFloat(treadmillDistance) <= 0);
  const disabled = !feedbackRating || treadmillDistanceMissing || isSubmitting;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>SESSION COMPLETE</Text>
          </View>

          {/* Recorded route — outdoor sessions with usable GPS only.
              Indoor / treadmill / GPS-denied sessions skip the map entirely
              so the layout doesn't get a blank tile. */}
          {!isIndoor && session.route && session.route.length >= 2 && (
            <View style={styles.mapWrapper}>
              <RouteMap route={session.route} height={220} />
            </View>
          )}

          {/* Stats */}
          <SessionSummaryCard session={session} />

          {/* Feedback */}
          <View style={styles.feedbackCard}>
            <Text style={styles.feedbackCardLabel}>How did that feel?</Text>
            <Text style={styles.feedbackCardHint}>Required to continue</Text>
            <FeedbackSelector selected={feedbackRating} onSelect={setFeedbackRating} />
          </View>

          {/* Treadmill stats — only shown for indoor sessions */}
          {isIndoor && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>TREADMILL STATS</Text>
              <View style={styles.treadmillCard}>
                <Text style={styles.treadmillHint}>
                  Enter your treadmill distance to log this session. Steps &
                  calories are optional.
                </Text>
                <View style={styles.treadmillFields}>
                  <View style={styles.treadmillField}>
                    <Text style={styles.treadmillFieldLabel}>Distance (km)</Text>
                    <TextInput
                      style={styles.treadmillInput}
                      placeholder="0.00"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="decimal-pad"
                      value={treadmillDistance}
                      onChangeText={setTreadmillDistance}
                    />
                  </View>
                  <View style={styles.treadmillField}>
                    <Text style={styles.treadmillFieldLabel}>Steps</Text>
                    <TextInput
                      style={styles.treadmillInput}
                      placeholder="0"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="number-pad"
                      value={treadmillSteps}
                      onChangeText={setTreadmillSteps}
                    />
                  </View>
                  <View style={styles.treadmillField}>
                    <Text style={styles.treadmillFieldLabel}>Calories</Text>
                    <TextInput
                      style={styles.treadmillInput}
                      placeholder="0"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="number-pad"
                      value={treadmillCalories}
                      onChangeText={setTreadmillCalories}
                    />
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.notesLabel}>Anything else? (optional)</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="How's your body feeling? Any observations?"
              placeholderTextColor={colors.textTertiary}
              value={feedbackNotes}
              onChangeText={setFeedbackNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Fixed action buttons — "Done" is primary, "Share" is secondary */}
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              disabled && styles.buttonDisabled,
              pressed && !disabled && styles.buttonPressed,
            ]}
            onPress={() => submit(false)}
            disabled={disabled}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Done</Text>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && { opacity: 0.6 }]}
            onPress={() => submit(true)}
            disabled={disabled}
          >
            <Text style={[styles.secondaryButtonText, disabled && styles.textDisabled]}>
              Share & Save
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 8,
  },
  header: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 28,
  },
  title: {
    fontFamily: fonts.titleRegular,
    fontSize: 36,
    color: '#fff',
    letterSpacing: 1.5,
  },
  mapWrapper: {
    marginBottom: 20,
  },
  section: {
    marginTop: 28,
  },
  sectionLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  notesLabel: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  notesInput: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    padding: 16,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: '#fff',
    minHeight: 90,
  },
  feedbackCard: {
    marginTop: 24,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(6,138,21,0.25)',
    gap: 16,
    shadowColor: '#068A15',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  feedbackCardLabel: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.textPrimary,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  feedbackCardHint: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.primary,
    textAlign: 'center',
    letterSpacing: 0.4,
    marginTop: -8,
  },
  treadmillCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    padding: 16,
    gap: 14,
  },
  treadmillHint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textTertiary,
    lineHeight: 18,
  },
  treadmillFields: {
    flexDirection: 'row',
    gap: 10,
  },
  treadmillField: {
    flex: 1,
    gap: 6,
  },
  treadmillFieldLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 0.8,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  treadmillInput: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textPrimary,
    textAlign: 'left',
  },
  bottomSpacer: { height: 24 },
  footer: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 12,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.background,
    gap: 10,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.45 },
  buttonPressed: { opacity: 0.85 },
  primaryButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: '#fff',
  },
  secondaryButton: {
    paddingVertical: 4,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textSecondary,
  },
  textDisabled: { opacity: 0.45 },
});
