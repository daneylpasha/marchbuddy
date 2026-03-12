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
import { detectMilestone } from '../../constants/milestones';
import { useCoachSetupStore } from '../../store/coachSetupStore';
import { useRunProgressStore } from '../../store/runProgressStore';
import { useSessionStore } from '../../store/sessionStore';
import { SessionSummaryCard } from './components/SessionSummaryCard';
import { FeedbackSelector } from './components/FeedbackSelector';
import { colors, fonts, spacing } from '../../theme';
import type { RunStackParamList } from '../../navigation/RunNavigator';

type Props = NativeStackScreenProps<RunStackParamList, 'PostSession'>;

export default function PostSessionScreen({ navigation, route }: Props) {
  const { session } = route.params;

  const { setupData, guestId } = useCoachSetupStore();
  const { updateAfterSession, incrementLevel, addToHistory } = useRunProgressStore();
  const { clearTodayOptions } = useSessionStore();

  const [feedbackRating, setFeedbackRating] = useState<FeedbackRating | null>(null);
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (shareAfter: boolean) => {
    if (!feedbackRating) return;

    setIsSubmitting(true);
    setError(null);

    const updatedSession: CompletedSession = {
      ...session,
      feedbackRating,
      feedbackNotes: feedbackNotes.trim() || null,
    };

    try {
      const result = sessionApi.processCompletedSession({
        sessionData: updatedSession,
        onboardingData: {
          userName: setupData.userName || 'there',
          triggerStatement: setupData.triggerStatement,
          anchorPerson: setupData.anchorPerson,
          primaryFear: setupData.primaryFear,
          successVision: setupData.successVision,
        },
      });

      // Snapshot distance BEFORE updating so detectMilestone can check threshold crossings
      const prevDistanceKm = useRunProgressStore.getState().progress?.totalDistanceKm ?? 0;

      // Persist session feedback to DB (fire-and-forget — never blocks the user)
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

      // Keep local progress store in sync
      updateAfterSession({
        durationMinutes: session.actualDurationMinutes,
        distanceKm: session.actualDistanceKm,
      });
      addToHistory({
        id: session.id,
        date: session.completedAt.split('T')[0],
        durationMinutes: session.actualDurationMinutes,
        distanceKm: session.actualDistanceKm,
        planTitle: session.planTitle,
        planLevel: session.planLevel,
      });

      // Local level-up check — doesn't depend on edge function
      const freshProgress = useRunProgressStore.getState().progress;
      const leveledUp = !!(
        freshProgress &&
        freshProgress.sessionsAtCurrentLevel >= 3 &&
        freshProgress.currentLevel < 16
      );
      if (leveledUp) {
        incrementLevel();
      }

      // Force Today screen to refresh options next visit
      clearTodayOptions();

      // Read state again after potential incrementLevel()
      const finalProgress = useRunProgressStore.getState().progress;
      const newLevel = finalProgress?.currentLevel ?? session.planLevel;

      // Detect milestone locally (independent of edge function result)
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
        });
      }
    } catch (err) {
      console.error('Error submitting feedback:', err);
      setError('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  const disabled = !feedbackRating || isSubmitting;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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

          {/* Stats */}
          <SessionSummaryCard session={session} />

          {/* Feedback */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>HOW DID THAT FEEL?</Text>
            <FeedbackSelector selected={feedbackRating} onSelect={setFeedbackRating} />
          </View>

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

          {error && <Text style={styles.errorText}>{error}</Text>}
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
  errorText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.danger,
    textAlign: 'center',
    marginTop: 16,
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
