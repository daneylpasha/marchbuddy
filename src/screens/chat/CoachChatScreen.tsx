import React, { useRef, useEffect, useState } from 'react';
import { FlatList, StyleSheet, KeyboardAvoidingView, Platform, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';

import { useChatStore } from '../../store/chatStore';
import { useCoachSetupStore } from '../../store/coachSetupStore';
import { useRunProgressStore } from '../../store/runProgressStore';
import { useSessionStore } from '../../store/sessionStore';
import { useNetworkStore } from '../../store/networkStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { ProBanner } from '../../components/upgrade/ProBanner';
import { analytics, EVENTS } from '../../services/analytics';
import { chatApi } from '../../services/chatApi';
import { getLevelDefinition } from '../../constants/sessionTemplates';
import type { ChatMessage as ChatMessageType, ChatContext } from '../../types/chat';

import { ChatHeader } from './components/ChatHeader';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { QuickActions } from './components/QuickActions';
import { TypingIndicator } from './components/TypingIndicator';
import { CoachChatBanner } from './components/CoachChatBanner';
import { colors, fonts } from '../../theme';

export const CoachChatScreen: React.FC = () => {
  const navigation = useNavigation();
  const flatListRef = useRef<FlatList>(null);
  const isConnected = useNetworkStore((s) => s.isConnected);

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

  const { canSendChat, incrementChatCount, openPaywall, tier } = useSubscriptionStore();

  const [showQuickActions, setShowQuickActions] = useState(true);
  const [hasUsedQuickAction, setHasUsedQuickAction] = useState(false);
  const chatBlocked = tier === 'free' && !canSendChat();

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
      recentSessions: sessionHistory.slice(-3).map((s) => {
        const parts = [`${s.durationMinutes}min`];
        if (s.distanceKm > 0) parts.push(`${s.distanceKm.toFixed(2)}km`);
        if (s.feedbackRating) parts.push(`rated: ${s.feedbackRating}`);
        if (s.endedEarly) parts.push('ended early');
        return { date: s.date, title: s.planTitle, feedback: parts.join(', ') };
      }),
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

  // Build quick actions context from user journey data
  const quickActionsContext = React.useMemo(() => {
    const totalSessions = progress?.totalSessionsCompleted ?? 0;
    const currentStreak = progress?.currentStreakDays ?? 0;
    const currentLevel = progress?.currentLevel ?? 1;
    let daysSinceLastSession: number | null = null;

    if (progress?.lastSessionDate) {
      const lastDate = new Date(progress.lastSessionDate);
      const now = new Date();
      lastDate.setHours(0, 0, 0, 0);
      now.setHours(0, 0, 0, 0);
      daysSinceLastSession = Math.floor(
        (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
      );
    }

    return { totalSessions, currentStreak, daysSinceLastSession, currentLevel };
  }, [progress]);

  const handleSendMessage = async (text: string, imageUri?: string) => {
    if (!text.trim() && !imageUri) return;
    if (!canSendChat()) {
      // Record the free-tier exhaustion as its own event (separate from
      // paywall_shown) so we can answer "how often do free users hit the
      // chat ceiling?" without being confused by paywall views from other
      // surfaces. paywall_shown will still fire from PaywallModal.
      analytics.track(EVENTS.free_chat_limit_hit, {
        messages_sent_today: useSubscriptionStore.getState().dailyChatCount,
      });
      openPaywall('chat_limit');
      return;
    }

    setShowQuickActions(false);
    setHasUsedQuickAction(true);
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
      // Only count toward the free-tier quota on a successful reply.
      // Network failures, server errors, or rate-limit responses don't burn
      // the user's daily message — they get to try again without penalty.
      incrementChatCount();

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

  const renderMessage = ({ item }: { item: ChatMessageType }) => <ChatMessage message={item} />;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ChatHeader onBack={() => navigation.goBack()} />
        <CoachChatBanner />
        {!isConnected && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineBannerText}>
              You're offline — new plans and coach replies won't be available until you're back
              online.
            </Text>
          </View>
        )}

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
              {showQuickActions && !hasUsedQuickAction && messages.length <= 4 && (
                <QuickActions
                  onSelect={(msg) => handleSendMessage(msg)}
                  context={quickActionsContext}
                />
              )}
              {chatBlocked && (
                <View style={styles.chatLimitWrap}>
                  <ProBanner variant="chat_limit" onPress={() => openPaywall('chat_limit')} />
                </View>
              )}
            </>
          }
        />

        <ChatInput onSend={handleSendMessage} disabled={isLoading || !isConnected || chatBlocked} />
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
  offlineBanner: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245,158,11,0.2)',
  },
  offlineBannerText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: '#F59E0B',
    textAlign: 'center',
    lineHeight: 18,
  },
  chatLimitWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
});
