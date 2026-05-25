import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import {
  HapticImpactStyle,
  HapticNotificationType,
  hapticImpact,
  hapticNotification,
} from '../../utils/haptics';

import { getMilestoneConfig } from '../../constants/milestones';
import { ConfettiAnimation } from './components/ConfettiAnimation';
import { MilestoneIcon } from './components/MilestoneIcon';
import { colors, fonts, spacing } from '../../theme';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import type { RunStackParamList } from '../../navigation/RunNavigator';
import ShareCard, { CARD_WIDTH, CARD_HEIGHT } from '../../components/session/ShareCard';
import { shareCelebrationCard } from '../../utils/shareCelebrationCard';

type Props = NativeStackScreenProps<RunStackParamList, 'Celebration'>;

export default function CelebrationScreen({ navigation, route }: Props) {
  const { milestoneId, coachFeedback, progressUpdate, session, shareAfter } = route.params;
  const { isLevelLocked, openPaywall } = useSubscriptionStore();
  const celebratingLockedLevel = progressUpdate.leveledUp && isLevelLocked(progressUpdate.newLevel);

  const shareCardRef = useRef<View>(null);
  const [isSharing, setIsSharing] = useState(false);

  const milestone = getMilestoneConfig(milestoneId);

  const iconScale = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  // Fail-safe: if the milestone config can't be resolved (legacy ID, data
  // out of sync), forward to CoachFeedback after commit instead of calling
  // navigation.replace() inside render. Doing it in render violates React's
  // "no state updates while rendering another component" rule and produces
  // a noisy console error.
  useEffect(() => {
    if (!milestone) {
      navigation.replace('CoachFeedback', {
        coachFeedback,
        progressUpdate,
        session,
        shareAfter,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestone]);

  useEffect(() => {
    if (!milestone) return;
    // Haptic burst on entry
    hapticNotification(HapticNotificationType.Success);

    Animated.sequence([
      Animated.spring(iconScale, {
        toValue: 1,
        tension: 55,
        friction: 4,
        useNativeDriver: true,
      }),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 380,
        useNativeDriver: true,
      }),
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();

    // Second impact when icon lands
    const timer = setTimeout(() => {
      hapticImpact(HapticImpactStyle.Heavy);
    }, 320);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestone]);

  const handleContinue = () => {
    navigation.replace('CoachFeedback', {
      coachFeedback,
      progressUpdate,
      session,
      shareAfter,
    });
  };

  const handleShare = async () => {
    if (!milestone || isSharing) return;
    setIsSharing(true);
    try {
      const caption = progressUpdate.leveledUp
        ? `Just hit Level ${progressUpdate.newLevel} on MarchBuddy 🎯`
        : 'Reached a new milestone on MarchBuddy 🏆';
      await shareCelebrationCard(shareCardRef, caption, 'level_up');
    } finally {
      setIsSharing(false);
    }
  };

  if (!milestone) {
    // useEffect above will forward to CoachFeedback. Render nothing in the
    // meantime so the user doesn't see a flash of an empty celebration UI.
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Off-screen card captured for one-tap share — not visible to user */}
      <View style={styles.offScreenCard} pointerEvents="none">
        <ShareCard ref={shareCardRef} session={session} />
      </View>

      {/* Confetti layer */}
      {milestone.confettiColors && <ConfettiAnimation colors={milestone.confettiColors} />}

      {/* Main content */}
      <View style={styles.content}>
        {/* Animated icon */}
        <Animated.View
          style={[
            styles.iconCircle,
            { backgroundColor: milestone.backgroundColor },
            { transform: [{ scale: iconScale }] },
          ]}
        >
          <MilestoneIcon name={milestone.icon} color={milestone.iconColor} size={60} />
        </Animated.View>

        {/* Text block */}
        <Animated.View style={[styles.textBlock, { opacity: textOpacity }]}>
          <Text style={styles.subtitle}>{milestone.subtitle}</Text>
          <Text style={styles.title}>{milestone.title}</Text>
          <Text style={styles.description}>{milestone.description}</Text>
        </Animated.View>
      </View>

      {/* Buttons */}
      <Animated.View style={[styles.footer, { opacity: buttonOpacity }]}>
        {celebratingLockedLevel ? (
          <>
            {/* Share first — the user earned this; don't gate the celebration */}
            <TouchableOpacity
              style={[styles.shareButton, isSharing && styles.shareButtonDisabled]}
              onPress={handleShare}
              activeOpacity={0.8}
              disabled={isSharing}
            >
              <Ionicons
                name={isSharing ? 'hourglass-outline' : 'share-social-outline'}
                size={18}
                color={colors.primary}
              />
              <Text style={styles.shareButtonText}>
                {isSharing ? 'Preparing…' : 'Share Achievement'}
              </Text>
            </TouchableOpacity>

            {/* Then the upgrade CTA — natural next step, not a paywall slap */}
            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={() => openPaywall('celebration_locked')}
              activeOpacity={0.85}
            >
              <Ionicons name="flash" size={18} color="#fff" />
              <Text style={styles.upgradeButtonText}>
                Unlock Level {progressUpdate.newLevel} with Pro
              </Text>
            </TouchableOpacity>

            {/* Tertiary dismiss */}
            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleContinue}
              activeOpacity={0.7}
            >
              <Text style={styles.skipButtonText}>Maybe later</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.shareButton, isSharing && styles.shareButtonDisabled]}
              onPress={handleShare}
              activeOpacity={0.8}
              disabled={isSharing}
            >
              <Ionicons
                name={isSharing ? 'hourglass-outline' : 'share-social-outline'}
                size={18}
                color={colors.primary}
              />
              <Text style={styles.shareButtonText}>
                {isSharing ? 'Preparing…' : 'Share Achievement'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.continueButton}
              onPress={handleContinue}
              activeOpacity={0.85}
            >
              <Text style={styles.continueButtonText}>Continue</Text>
            </TouchableOpacity>
          </>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding + 16,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  textBlock: {
    alignItems: 'center',
  },
  subtitle: {
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontFamily: fonts.titleRegular,
    fontSize: 52,
    color: colors.textPrimary,
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 16,
    lineHeight: 56,
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: 17,
    lineHeight: 26,
    color: colors.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  footer: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.sm,
    gap: 12,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 15,
    borderRadius: 30,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  shareButtonText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.primary,
    letterSpacing: 0.3,
  },
  continueButton: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
  },
  continueButtonText: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  upgradeButton: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  upgradeButtonText: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipButtonText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textTertiary,
    letterSpacing: 0.3,
  },
  offScreenCard: {
    position: 'absolute',
    left: -(CARD_WIDTH + 50),
    top: 0,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },
  shareButtonDisabled: {
    opacity: 0.6,
  },
});
