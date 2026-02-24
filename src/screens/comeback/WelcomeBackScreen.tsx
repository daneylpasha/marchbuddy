import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { useRunProgressStore } from '../../store/runProgressStore';
import { useCoachSetupStore } from '../../store/coachSetupStore';
import { comebackApi } from '../../services/comebackApi';
import { analyzeGap, formatGapDuration } from '../../utils/gapDetection';
import {
  ComebackChoice,
  ComebackDecision,
  FitnessFeeling,
  ComebackContext,
} from '../../types/comeback';

import { ComebackOption } from './components/ComebackOption';
import { FitnessCheckForm } from './components/FitnessCheckForm';
import { AiDecisionView } from './components/AiDecisionView';

import { colors, fonts } from '../../theme';
import { RunStackParamList } from '../../navigation/RunNavigator';

type NavigationProp = NativeStackNavigationProp<RunStackParamList>;

type ViewState = 'options' | 'fitness_check' | 'loading' | 'decision';

export const WelcomeBackScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();

  const progress = useRunProgressStore((state) => state.progress);
  const setLevel = useRunProgressStore((state) => state.setLevel);
  const markComebackHandled = useRunProgressStore((state) => state.markComebackHandled);

  const setupData = useCoachSetupStore((state) => state.setupData);

  const [viewState, setViewState] = useState<ViewState>('options');
  const [decision, setDecision] = useState<ComebackDecision | null>(null);

  const gapAnalysis = analyzeGap(progress);
  const daysSince = gapAnalysis.daysSinceLastSession ?? 0;
  const previousLevel = gapAnalysis.previousLevel;
  const isExtendedGap = gapAnalysis.status === 'extended_gap';

  const buildContext = (extra?: Partial<ComebackContext>): ComebackContext => ({
    daysSinceLastSession: daysSince,
    previousLevel,
    totalSessionsCompleted: progress?.totalSessionsCompleted ?? 0,
    bestStreakDays: progress?.bestStreakDays ?? 0,
    lastSessionFeedback: null,
    userName: setupData.userName || 'there',
    triggerStatement: setupData.triggerStatement || '',
    anchorPerson: setupData.anchorPerson || '',
    primaryFear: setupData.primaryFear || '',
    ...extra,
  });

  const getRecommendation = async (context: ComebackContext) => {
    setViewState('loading');
    try {
      const result = await comebackApi.getRecommendation(context);
      setDecision(result);
      setViewState('decision');
    } catch (error) {
      console.error('Error getting recommendation:', error);
      setDecision(comebackApi.getFallbackRecommendation(context));
      setViewState('decision');
    }
  };

  const handleChoice = (choice: ComebackChoice) => {
    switch (choice) {
      case 'fitness_check':
        setViewState('fitness_check');
        break;

      case 'chat_about_it':
      case 'been_active':
        markComebackHandled();
        navigation.navigate('CoachChat', {
          comebackMode: true,
          comebackContext: { daysSince, previousLevel, choice },
        });
        break;

      case 'fresh_start':
        getRecommendation(
          buildContext({
            additionalContext: 'User explicitly wants a fresh start after extended break.',
          }),
        );
        break;

      case 'quick_decision':
        getRecommendation(buildContext());
        break;
    }
  };

  const handleFitnessCheckSubmit = (feeling: FitnessFeeling) => {
    getRecommendation(buildContext({ fitnessFeeling: feeling }));
  };

  const handleAcceptDecision = () => {
    if (decision) {
      setLevel(decision.recommendedLevel);
    }
    markComebackHandled();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Today' }],
    });
  };

  const handleDiscuss = () => {
    markComebackHandled();
    navigation.navigate('CoachChat', {
      comebackMode: true,
      comebackContext: { daysSince, previousLevel, aiSuggestion: decision },
    });
  };

  const renderContent = () => {
    switch (viewState) {
      case 'fitness_check':
        return (
          <FitnessCheckForm
            previousLevel={previousLevel}
            onSubmit={handleFitnessCheckSubmit}
            onBack={() => setViewState('options')}
          />
        );

      case 'loading':
        return (
          <View style={styles.loadingContainer}>
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingTitle}>Analyzing Your History</Text>
              <Text style={styles.loadingSubtitle}>
                Finding the right level for your comeback...
              </Text>
            </View>
          </View>
        );

      case 'decision':
        if (!decision) return null;
        return (
          <AiDecisionView
            decision={decision}
            previousLevel={previousLevel}
            onAccept={handleAcceptDecision}
            onDiscuss={handleDiscuss}
          />
        );

      case 'options':
      default:
        return (
          <>
            <View style={styles.welcomeHeader}>
              <View style={styles.welcomeIcon}>
                <Ionicons name="hand-right" size={40} color={colors.primary} />
              </View>
              <Text style={styles.welcomeTitle}>
                Welcome Back, {setupData.userName || 'Friend'}!
              </Text>
              <Text style={styles.gapText}>
                It's been {formatGapDuration(daysSince)} since your last session.
              </Text>
              <Text style={styles.noJudgment}>
                No judgment — life happens. Let's figure out the best way forward.
              </Text>
            </View>

            <View style={styles.options}>
              <Text style={styles.optionsLabel}>HOW WOULD YOU LIKE TO START?</Text>

              <ComebackOption
                icon="body-outline"
                title="Quick Fitness Check"
                description="Answer one question about how you feel. I'll recommend the right level."
                onPress={() => handleChoice('fitness_check')}
              />

              <ComebackOption
                icon="chatbubbles-outline"
                title="Let's Chat About It"
                description="Tell me what's been going on. I'll factor everything in."
                onPress={() => handleChoice('chat_about_it')}
              />

              {isExtendedGap && (
                <>
                  <ComebackOption
                    icon="bicycle-outline"
                    title="I've Been Active Elsewhere"
                    description="Gym, swimming, cycling? Let me know and I'll adjust."
                    onPress={() => handleChoice('been_active')}
                  />

                  <ComebackOption
                    icon="refresh-outline"
                    title="I Want a Fresh Start"
                    description="That's perfectly fine. Let's find the right level to begin again."
                    onPress={() => handleChoice('fresh_start')}
                  />
                </>
              )}
            </View>

            <TouchableOpacity
              style={styles.quickDecision}
              onPress={() => handleChoice('quick_decision')}
            >
              <Text style={styles.quickDecisionText}>Just tell me where to start →</Text>
            </TouchableOpacity>
          </>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderContent()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 40,
    flexGrow: 1,
  },

  // Welcome header
  welcomeHeader: {
    alignItems: 'center',
    marginBottom: 40,
  },
  welcomeIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primaryDim,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeTitle: {
    fontFamily: fonts.titleRegular,
    fontSize: 32,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
  },
  gapText: {
    fontFamily: fonts.medium,
    fontSize: 18,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  noJudgment: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 24,
  },

  // Options
  options: {
    gap: 12,
    marginBottom: 24,
  },
  optionsLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.textTertiary,
    marginBottom: 8,
  },

  // Quick decision
  quickDecision: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  quickDecisionText: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.primary,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  loadingBox: {
    alignItems: 'center',
  },
  loadingTitle: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.textPrimary,
    marginTop: 24,
    marginBottom: 8,
  },
  loadingSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
