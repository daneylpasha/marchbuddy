import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, fonts } from '../../theme';
import ChatBubble from '../../components/chat/ChatBubble';
import TypingIndicator from '../../components/chat/TypingIndicator';
import ChipSelector from '../../components/chat/ChipSelector';
import OnboardingSummaryCard from '../../components/onboarding/OnboardingSummaryCard';
import { useProfileStore } from '../../store/profileStore';
import { useAuthStore } from '../../store/authStore';
import { useProgressStore } from '../../store/progressStore';
import {
  ONBOARDING_STAGES,
  TOTAL_USER_STEPS,
  buildProfileFromData,
  generateSmartAcknowledgment,
  getEmptyOnboardingData,
  getStepNumber,
} from '../../services/onboardingService';
import type { OnboardingData } from '../../services/onboardingService';

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function OnboardingChatScreen() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [stageIndex, setStageIndex] = useState(0);
  const [data, setData] = useState<OnboardingData>(getEmptyOnboardingData());
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [inputLocked, setInputLocked] = useState(true);
  const [showSummary, setShowSummary] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const msgCounter = useRef(0);

  const { updateProfile, setOnboardingCompleted } = useProfileStore();
  const user = useAuthStore((s) => s.user);

  const nextId = () => {
    msgCounter.current += 1;
    return `msg-${msgCounter.current}`;
  };

  // Push AI messages with typing delay
  const pushAiMessages = useCallback(async (texts: string[]) => {
    setInputLocked(true);
    for (const text of texts) {
      setIsTyping(true);
      await delay(400 + Math.random() * 200);
      setIsTyping(false);
      setMessages((prev) => [...prev, { id: nextId(), role: 'assistant', content: text }]);
      await delay(100);
    }
    setInputLocked(false);
  }, []);

  // Start the first stage on mount
  useEffect(() => {
    pushAiMessages(ONBOARDING_STAGES[0].messages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll when messages change
  useEffect(() => {
    const timer = setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages, isTyping]);

  const currentStage = ONBOARDING_STAGES[stageIndex];
  const stepNumber = showSummary ? TOTAL_USER_STEPS : getStepNumber(stageIndex);

  const handleUserInput = async (rawInput: string) => {
    if (inputLocked || !rawInput.trim()) return;

    const stage = ONBOARDING_STAGES[stageIndex];

    // Validate
    const error = stage.validate(rawInput);
    if (error) {
      await pushAiMessages([error]);
      return;
    }

    // Show user message
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', content: rawInput }]);
    setInputText('');

    // Parse and store
    const parsed = stage.parse(rawInput);
    const newData = { ...data };

    switch (stage.id) {
      case 'primaryGoal':
        newData.primaryGoal = parsed;
        break;
      default:
        if (stage.field) {
          (newData as any)[stage.field] = parsed;
        }
        break;
    }
    setData(newData);

    // Check if this was the last question stage
    const isLastStage = stageIndex === ONBOARDING_STAGES.length - 1;

    if (isLastStage) {
      // Show summary card instead of continuing chat
      setInputLocked(true);
      setIsTyping(true);
      await delay(300);
      setIsTyping(false);
      setShowSummary(true);
      return;
    }

    // Acknowledgment
    const ack = generateSmartAcknowledgment(stage.id, rawInput, newData);

    // Move to next stage
    const nextIndex = stageIndex + 1;
    setStageIndex(nextIndex);

    const nextStage = ONBOARDING_STAGES[nextIndex];
    const nextMessages = nextStage.messages;
    const allMessages = ack ? [ack, ...nextMessages] : nextMessages;
    await pushAiMessages(allMessages);
  };

  const handleSubmitText = () => {
    handleUserInput(inputText);
  };

  const handleChipSelect = (option: string) => {
    handleUserInput(option);
  };

  // ─── Summary card handlers ──────────────────────────────────────────────────

  const handleSummaryEdit = (field: keyof OnboardingData, value: any) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSummaryConfirm = async () => {
    setIsSaving(true);

    // Save the profile
    if (user) {
      const profile = buildProfileFromData(user.id, data);
      await updateProfile(profile);

      // Create initial weight entry so Progress screen has data from day 1
      if (profile.currentWeight && profile.currentWeight > 0) {
        useProgressStore.getState().logWeight(user.id, profile.currentWeight);
      }
    }

    await delay(800);
    setOnboardingCompleted(true);
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  // If summary mode, show the editable summary card
  if (showSummary) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <Text style={styles.stepText}>Step {TOTAL_USER_STEPS} of {TOTAL_USER_STEPS}</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '100%' }]} />
          </View>
        </View>

        <OnboardingSummaryCard
          data={data}
          onEdit={handleSummaryEdit}
          onConfirm={handleSummaryConfirm}
          isLoading={isSaving}
        />
      </SafeAreaView>
    );
  }

  const renderInput = () => {
    if (inputLocked) return null;

    const stage = currentStage;

    if (stage.inputType === 'select' && stage.options) {
      return (
        <View style={styles.inputArea}>
          <ChipSelector options={stage.options} onSelect={handleChipSelect} disabled={inputLocked} />
        </View>
      );
    }

    const isNumber = stage.inputType === 'number';

    return (
      <View style={styles.inputArea}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder={isNumber ? `Enter ${stage.numberUnit ?? 'value'}` : 'Type your answer...'}
            placeholderTextColor={colors.textTertiary}
            keyboardType={isNumber ? 'numeric' : 'default'}
            returnKeyType="send"
            onSubmitEditing={handleSubmitText}
            editable={!inputLocked}
          />
          <Pressable
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={handleSubmitText}
            disabled={!inputText.trim() || inputLocked}
          >
            <Text style={styles.sendButtonText}>&#x2192;</Text>
          </Pressable>
        </View>
        {isNumber && stage.numberUnit && (
          <Text style={styles.unitHint}>{stage.numberUnit} ({stage.numberMin}–{stage.numberMax})</Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <Text style={styles.stepText}>Step {stepNumber} of {TOTAL_USER_STEPS}</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${(stepNumber / TOTAL_USER_STEPS) * 100}%` }]} />
        </View>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ChatBubble role={item.role} content={item.content} />}
          contentContainerStyle={styles.messageList}
          ListFooterComponent={isTyping ? <TypingIndicator /> : null}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {renderInput()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  progressContainer: {
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceElevated,
  },
  stepText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 6,
    fontFamily: fonts.medium,
    letterSpacing: 0.3,
  },
  progressBar: {
    height: 3,
    backgroundColor: colors.dotInactive,
    borderRadius: 2,
  },
  progressFill: {
    height: 3,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  messageList: {
    paddingVertical: 16,
  },
  inputArea: {
    borderTopWidth: 1,
    borderTopColor: colors.surfaceElevated,
    paddingVertical: 8,
    backgroundColor: colors.background,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 48,
  },
  sendButtonDisabled: {
    backgroundColor: colors.dotInactive,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: fonts.bold,
    letterSpacing: 0.3,
  },
  unitHint: {
    color: colors.textTertiary,
    fontSize: 12,
    paddingHorizontal: 28,
    paddingTop: 4,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
  },
});
