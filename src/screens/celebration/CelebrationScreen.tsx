import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { getMilestoneConfig } from '../../constants/milestones';
import { ConfettiAnimation } from './components/ConfettiAnimation';
import { MilestoneIcon } from './components/MilestoneIcon';
import { colors, fonts, spacing } from '../../theme';
import type { RunStackParamList } from '../../navigation/RunNavigator';

type Props = NativeStackScreenProps<RunStackParamList, 'Celebration'>;

export default function CelebrationScreen({ navigation, route }: Props) {
  const { milestoneId, coachFeedback, progressUpdate, session, shareAfter } = route.params;

  const milestone = getMilestoneConfig(milestoneId);

  const iconScale = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Haptic burst on entry
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }, 320);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleContinue = () => {
    navigation.replace('CoachFeedback', {
      coachFeedback,
      progressUpdate,
      session,
      shareAfter,
    });
  };

  const handleShare = async () => {
    if (!milestone) return;
    try {
      await Share.share({ message: milestone.shareText });
    } catch {
      // Share dismissed — ignore
    }
  };

  if (!milestone) {
    // Shouldn't happen, but fail-safe
    handleContinue();
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Confetti layer */}
      {milestone.confettiColors && (
        <ConfettiAnimation colors={milestone.confettiColors} />
      )}

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
        <TouchableOpacity
          style={styles.shareButton}
          onPress={handleShare}
          activeOpacity={0.8}
        >
          <Ionicons name="share-social-outline" size={18} color={colors.primary} />
          <Text style={styles.shareButtonText}>Share Achievement</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleContinue}
          activeOpacity={0.85}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
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
});
