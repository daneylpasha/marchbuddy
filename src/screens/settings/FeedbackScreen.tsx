import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { feedbackApi } from '../../services/feedbackApi';
import { useRunProgressStore } from '../../store/runProgressStore';
import { useCoachSetupStore } from '../../store/coachSetupStore';
import { APP_CONFIG } from '../../config/appConfig';
import { colors, fonts, spacing } from '../../theme';

type CategoryId = 'bug' | 'feature_request' | 'general' | 'workout' | 'coach';

interface Category {
  id: CategoryId;
  label: string;
  emoji: string;
  placeholder: string;
}

const CATEGORIES: Category[] = [
  {
    id: 'bug',
    label: 'Bug Report',
    emoji: '🐛',
    placeholder: 'What happened? What did you expect?',
  },
  {
    id: 'feature_request',
    label: 'Feature Request',
    emoji: '💡',
    placeholder: 'What would make MarchBuddy better?',
  },
  {
    id: 'general',
    label: 'General',
    emoji: '💬',
    placeholder: "Tell us what's on your mind...",
  },
  {
    id: 'workout',
    label: 'Workouts',
    emoji: '🏃',
    placeholder: 'How are the sessions feeling?',
  },
  {
    id: 'coach',
    label: 'AI Coach',
    emoji: '🤖',
    placeholder: "How's the coaching experience?",
  },
];

export default function FeedbackScreen() {
  const navigation = useNavigation();

  const progress = useRunProgressStore((s) => s.progress);
  const guestId = useCoachSetupStore((s) => s.guestId);

  const [selectedCategory, setSelectedCategory] = useState<CategoryId | null>(null);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitState, setSubmitState] = useState<'idle' | 'success' | 'error'>('idle');

  const currentCategory = CATEGORIES.find((c) => c.id === selectedCategory);
  const charCount = message.length;
  const canSubmit = selectedCategory !== null && charCount >= 10 && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit || !guestId) return;

    setIsSubmitting(true);
    setSubmitState('idle');

    try {
      await feedbackApi.submitUserFeedback({
        userId: guestId,
        category: selectedCategory!,
        message: message.trim(),
        appVersion: APP_CONFIG.VERSION,
        devicePlatform: Platform.OS,
        currentLevel: progress?.currentLevel ?? 1,
        sessionsCount: progress?.totalSessionsCompleted ?? 0,
      });

      setSubmitState('success');
      setTimeout(() => navigation.goBack(), 2000);
    } catch {
      setSubmitState('error');
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Send Feedback</Text>
        <View style={styles.headerSpacer} />
      </View>

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
          {/* Category chips */}
          <Text style={styles.sectionLabel}>CATEGORY</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chipsContent}
          >
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                  onPress={() => setSelectedCategory(cat.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.chipEmoji}>{cat.emoji}</Text>
                  <Text style={[styles.chipLabel, isSelected && styles.chipLabelSelected]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Message input */}
          <Text style={[styles.sectionLabel, styles.messageSectionLabel]}>MESSAGE</Text>
          <TextInput
            style={styles.messageInput}
            value={message}
            onChangeText={setMessage}
            placeholder={currentCategory?.placeholder ?? "Tell us what's on your mind..."}
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            maxLength={1000}
            editable={!isSubmitting && submitState !== 'success'}
            selectionColor={colors.primary}
          />
          <Text style={[styles.charCount, charCount < 10 && charCount > 0 && styles.charCountWarn]}>
            {charCount > 0 && charCount < 10
              ? `${10 - charCount} more characters needed`
              : `${charCount}/1000`}
          </Text>

          {submitState === 'error' && (
            <Text style={styles.errorText}>Something went wrong, try again</Text>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>

        <SafeAreaView edges={['bottom']} style={styles.footer}>
          {submitState === 'success' ? (
            <View style={styles.successRow}>
              <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
              <Text style={styles.successText}>Thanks! We read every message</Text>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                !canSubmit && styles.submitButtonDisabled,
                pressed && canSubmit && { opacity: 0.85 },
              ]}
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.textPrimary} />
              ) : (
                <Text style={styles.submitButtonText}>Submit Feedback</Text>
              )}
            </Pressable>
          )}
        </SafeAreaView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  backButton: { padding: 4 },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textPrimary,
  },
  headerSpacer: { width: 36 },
  scrollContent: {
    padding: spacing.screenPadding,
    paddingBottom: 16,
  },
  sectionLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.textTertiary,
    marginBottom: 12,
  },
  messageSectionLabel: {
    marginTop: 28,
  },
  chipsScroll: {
    marginHorizontal: -spacing.screenPadding,
  },
  chipsContent: {
    paddingHorizontal: spacing.screenPadding,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.divider,
    backgroundColor: colors.surfaceElevated,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDim,
  },
  chipEmoji: { fontSize: 15 },
  chipLabel: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  chipLabelSelected: {
    color: colors.primary,
  },
  messageInput: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: 16,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textPrimary,
    minHeight: 130,
  },
  charCount: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'right',
    marginTop: 6,
  },
  charCountWarn: {
    color: colors.warning,
  },
  errorText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.danger,
    textAlign: 'center',
    marginTop: 12,
  },
  bottomSpacer: { height: 8 },
  footer: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.background,
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
  },
  submitButtonDisabled: { opacity: 0.45 },
  submitButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
  },
  successText: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.primary,
  },
});
