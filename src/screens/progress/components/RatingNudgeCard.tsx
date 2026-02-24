import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { feedbackApi } from '../../../services/feedbackApi';
import { useFeedbackStore } from '../../../store/feedbackStore';
import { useCoachSetupStore } from '../../../store/coachSetupStore';
import { colors, fonts } from '../../../theme';

// expo-store-review is optional — loaded dynamically so a missing package
// doesn't crash the app. Run: npx expo install expo-store-review
let StoreReview: typeof import('expo-store-review') | null = null;
try {
  StoreReview = require('expo-store-review');
} catch {}

interface RatingNudgeCardProps {
  totalSessions: number;
}

export const RatingNudgeCard: React.FC<RatingNudgeCardProps> = ({ totalSessions }) => {
  const navigation = useNavigation<any>();
  const [isLoading, setIsLoading] = useState(false);

  const completeRatingPrompt = useFeedbackStore((s) => s.completeRatingPrompt);
  const snoozeRatingPrompt = useFeedbackStore((s) => s.snoozeRatingPrompt);
  const guestId = useCoachSetupStore((s) => s.guestId);

  const logPromptResponse = (response: 'loved_it' | 'could_be_better' | 'dismissed') => {
    if (guestId) {
      feedbackApi
        .submitAppRatingPrompt({ userId: guestId, response, sessionsAtPrompt: totalSessions })
        .catch(() => {});
    }
  };

  const handleLoveIt = async () => {
    setIsLoading(true);
    completeRatingPrompt();
    logPromptResponse('loved_it');
    try {
      if (StoreReview) {
        const canReview = await StoreReview.hasAction();
        if (canReview) await StoreReview.requestReview();
      }
    } catch {}
    setIsLoading(false);
  };

  const handleCouldBeBetter = () => {
    completeRatingPrompt();
    logPromptResponse('could_be_better');
    navigation.navigate('Feedback');
  };

  const handleMaybeLater = () => {
    snoozeRatingPrompt();
  };

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.celebEmoji}>🎉</Text>
        <View style={styles.textBlock}>
          <Text style={styles.title}>You've completed {totalSessions} sessions!</Text>
          <Text style={styles.subtitle}>How's MarchBuddy working for you?</Text>
        </View>
        <TouchableOpacity
          onPress={handleMaybeLater}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={20} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity
          style={styles.loveButton}
          onPress={handleLoveIt}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.textPrimary} />
          ) : (
            <Text style={styles.loveButtonText}>❤️ Loving it</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.betterButton}
          onPress={handleCouldBeBetter}
          activeOpacity={0.8}
        >
          <Text style={styles.betterButtonText}>🤔 Could be better</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.maybeLater} onPress={handleMaybeLater} activeOpacity={0.6}>
        <Text style={styles.maybeLaterText}>Maybe later</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.primary,
    padding: 18,
    marginBottom: 20,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 16,
  },
  celebEmoji: {
    fontSize: 24,
    lineHeight: 30,
  },
  textBlock: {
    flex: 1,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 3,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
  },
  loveButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  loveButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  betterButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.divider,
  },
  betterButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  maybeLater: {
    alignItems: 'center',
    paddingTop: 12,
  },
  maybeLaterText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textTertiary,
  },
});
