import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../theme';
import { useSettingsStore } from '../store/settingsStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Card content width = screen width minus the container's horizontal padding (screenPadding × 2)
// We use the card's internal padding for the content area
const CARD_PADDING = 24;

interface Tip {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  description: string;
  accent: string;
}

const TIPS: Tip[] = [
  {
    icon: 'chatbubbles',
    title: 'Your AI Coach',
    description:
      'Tap the Coach tab to chat anytime. Ask for motivation, adjust your plan, or just check in.',
    accent: colors.primary,
  },
  {
    icon: 'flame',
    title: 'Streaks & Rest Days',
    description:
      "Run consistently to build streaks. Need a break? Declare a rest day — your streak stays safe.",
    accent: colors.streak,
  },
  {
    icon: 'stats-chart',
    title: 'Track Your Journey',
    description:
      'The Progress tab shows your level, milestones, and session history. Watch yourself grow.',
    accent: '#60A5FA',
  },
];

export function FeatureTips() {
  const { hasSeenFeatureTips, setHasSeenFeatureTips } = useSettingsStore();
  const [currentTip, setCurrentTip] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const isLast = currentTip === TIPS.length - 1;

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const pageWidth = event.nativeEvent.layoutMeasurement.width;
      const page = Math.round(offsetX / pageWidth);
      if (page !== currentTip && page >= 0 && page < TIPS.length) {
        setCurrentTip(page);
      }
    },
    [currentTip],
  );

  const handleNext = useCallback(() => {
    if (isLast) {
      setHasSeenFeatureTips(true);
    } else {
      const nextPage = currentTip + 1;
      scrollRef.current?.scrollTo({ x: nextPage * SCREEN_WIDTH, animated: true });
      // State will update via onMomentumScrollEnd / onScroll
    }
  }, [isLast, currentTip, setHasSeenFeatureTips]);

  const handleSkip = useCallback(() => {
    setHasSeenFeatureTips(true);
  }, [setHasSeenFeatureTips]);

  if (hasSeenFeatureTips) return null;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Swipeable tip pages */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          bounces={false}
          style={styles.scrollView}
        >
          {TIPS.map((tip, index) => (
            <View key={index} style={styles.tipPage}>
              <View style={[styles.iconCircle, { backgroundColor: tip.accent + '20' }]}>
                <Ionicons name={tip.icon} size={28} color={tip.accent} />
              </View>
              <Text style={styles.title}>{tip.title}</Text>
              <Text style={styles.description}>{tip.description}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Dots */}
        <View style={styles.dotsRow}>
          {TIPS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === currentTip ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable onPress={handleSkip} hitSlop={12}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
          <Pressable style={styles.nextButton} onPress={handleNext}>
            <Text style={styles.nextButtonText}>
              {isLast ? "Let's go!" : 'Next'}
            </Text>
            {!isLast && (
              <Ionicons name="chevron-forward" size={16} color={colors.background} />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: spacing.cardRadius,
    paddingTop: 24,
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    overflow: 'hidden',
  },
  scrollView: {
    width: '100%',
  },
  tipPage: {
    width: SCREEN_WIDTH - (spacing.screenPadding * 2),
    alignItems: 'center',
    paddingHorizontal: CARD_PADDING,
    gap: 12,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 18,
    color: colors.textPrimary,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: colors.primary,
  },
  dotInactive: {
    backgroundColor: colors.surfaceBorder,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 16,
    paddingHorizontal: CARD_PADDING,
  },
  skipText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textTertiary,
    letterSpacing: 0.3,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 4,
  },
  nextButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.background,
    letterSpacing: 0.3,
  },
});
