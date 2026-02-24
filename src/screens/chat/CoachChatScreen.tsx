import React, { useRef, useEffect, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';

import { useChatStore } from '../../store/chatStore';
import { useCoachSetupStore } from '../../store/coachSetupStore';
import { useRunProgressStore } from '../../store/runProgressStore';
import { useSessionStore } from '../../store/sessionStore';
import { chatApi } from '../../services/chatApi';
import { getLevelDefinition } from '../../constants/sessionTemplates';
import type { ChatMessage as ChatMessageType, ChatContext } from '../../types/chat';

import { ChatHeader } from './components/ChatHeader';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { QuickActions } from './components/QuickActions';
import { TypingIndicator } from './components/TypingIndicator';
import { CoachChatBanner } from './components/CoachChatBanner';
import { colors } from '../../theme';

export const CoachChatScreen: React.FC = () => {
  const navigation = useNavigation();
  const flatListRef = useRef<FlatList>(null);

  const {
    messages,
    isLoading,
    addUserMessage,
    addCoachMessage,
    addSystemMessage,
    setLoading,
    initializeChat,
    markAsRead,
  } = useChatStore();

  const { setPlanAdjustment } = useSessionStore();

  const setupData = useCoachSetupStore((state) => state.setupData);
  const progress = useRunProgressStore((state) => state.progress);
  const sessionHistory = useRunProgressStore((state) => state.sessionHistory);

  const [showQuickActions, setShowQuickActions] = useState(true);

  useEffect(() => {
    initializeChat(setupData.userName || 'there');
    markAsRead();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages.length]);

  const buildContext = (): ChatContext => {
    const currentLevel = progress?.currentLevel ?? 1;
    const levelDef = getLevelDefinition(currentLevel);

    return {
      userName: setupData.userName || 'there',
      currentLevel,
      totalSessions: progress?.totalSessionsCompleted ?? 0,
      currentStreak: progress?.currentStreakDays ?? 0,
      lastSessionDate: progress?.lastSessionDate ?? null,
      triggerStatement: setupData.triggerStatement ?? '',
      anchorPerson: setupData.anchorPerson ?? '',
      primaryFear: setupData.primaryFear ?? '',
      successVision: setupData.successVision ?? '',
      recentSessions: sessionHistory.slice(-3).map((s) => ({
        date: s.date,
        title: s.planTitle,
        feedback: `${s.durationMinutes}min`,
      })),
      availableSessions: levelDef
        ? {
            recommended: {
              title: levelDef.recommendedTemplate.title,
              durationMinutes: levelDef.recommendedTemplate.totalDurationMinutes,
            },
            quick: {
              title: levelDef.quickTemplate.title,
              durationMinutes: levelDef.quickTemplate.totalDurationMinutes,
            },
            challenge: {
              title: levelDef.challengeTemplate.title,
              durationMinutes: levelDef.challengeTemplate.totalDurationMinutes,
            },
            push: {
              title: levelDef.pushTemplate.title,
              durationMinutes: levelDef.pushTemplate.totalDurationMinutes,
            },
          }
        : {
            recommended: { title: 'Standard Session', durationMinutes: 18 },
            quick: { title: 'Quick Session', durationMinutes: 12 },
            challenge: { title: 'Challenge Session', durationMinutes: 22 },
            push: { title: 'Push Session', durationMinutes: 28 },
          },
    };
  };

  const handleSendMessage = async (text: string, imageUri?: string) => {
    if (!text.trim() && !imageUri) return;

    setShowQuickActions(false);
    addUserMessage(text, imageUri);
    setLoading(true);

    try {
      let imageBase64: string | undefined;
      if (imageUri) {
        imageBase64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: 'base64',
        });
      }

      const result = await chatApi.sendMessage({
        message: text,
        imageBase64,
        context: buildContext(),
        recentMessages: useChatStore.getState().messages,
      });

      addCoachMessage(result.reply);

      // Handle plan adjustment
      if (result.shouldAdjustPlan && result.adjustment) {
        const adj = result.adjustment;
        setPlanAdjustment({
          type: adj.type,
          suggestedVariant: adj.suggestedVariant,
          validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });
        const label =
          adj.suggestedVariant === 'rest'
            ? 'Rest day — no session today'
            : adj.suggestedVariant === 'challenge'
              ? "Today's plan bumped up to Challenge"
              : "Today's plan switched to Quick session";
        addSystemMessage(`\u2713 ${label}`);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      addCoachMessage("Sorry, I couldn't process that. Try again?");
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessageType }) => (
    <ChatMessage message={item} />
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ChatHeader onBack={() => navigation.goBack()} />
        <CoachChatBanner />

        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messageList}
          contentContainerStyle={styles.messageListContent}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            <>
              {isLoading && <TypingIndicator />}
              {showQuickActions && messages.length <= 1 && (
                <QuickActions onSelect={(msg) => handleSendMessage(msg)} />
              )}
            </>
          }
        />

        <ChatInput onSend={handleSendMessage} disabled={isLoading} />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

export default CoachChatScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
});
