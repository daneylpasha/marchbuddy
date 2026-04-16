import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, touchTarget } from '../../theme';
import type { IntroStackParamList } from '../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<IntroStackParamList, 'FeatureOnboarding'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Feature {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  description: string;
  accentWord: string;
  accent: string;
  gradient: readonly [string, string, string];
}

const FEATURES: Feature[] = [
  {
    icon: 'chatbubbles',
    title: 'Your AI Coach',
    description: 'Get personalized guidance every step of the way. Your coach adapts to your level and keeps you motivated.',
    accentWord: 'personalized',
    accent: colors.primary,
    gradient: ['#0A0A0A', '#0A0A0A', '#091A13'],
  },
  {
    icon: 'flame',
    title: 'Streaks & Rest Days',
    description: 'Build consistency with streaks. Need a break? Declare a rest day and your streak stays safe.',
    accentWord: 'consistency',
    accent: colors.streak,
    gradient: ['#0A0A0A', '#0A0A0A', '#1A0F00'],
  },
  {
    icon: 'stats-chart',
    title: 'Track Your Journey',
    description: 'Watch yourself grow with detailed progress tracking. Levels, milestones, and history — all in one place.',
    accentWord: 'grow',
    accent: '#60A5FA',
    gradient: ['#0A0A0A', '#0A0A0A', '#050D1A'],
  },
];

// Render description with one accent-colored word
function AccentDescription({ text, accentWord, accentColor }: {
  text: string;
  accentWord: string;
  accentColor: string;
}) {
  const parts = text.split(accentWord);
  if (parts.length < 2) return <Text style={styles.description}>{text}</Text>;
  return (
    <Text style={styles.description}>
      {parts[0]}
      <Text style={{ color: accentColor, fontFamily: fonts.semiBold }}>{accentWord}</Text>
      {parts[1]}
    </Text>
  );
}

export default function FeatureOnboardingScreen() {
  const navigation = useNavigation<Nav>();
  const [currentPage, setCurrentPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  // Content entry animation
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentSlide = useRef(new Animated.Value(0)).current;

  // Dot width animations
  const dotWidths = useRef(FEATURES.map((_, i) => new Animated.Value(i === 0 ? 24 : 8))).current;

  // CTA press animation
  const ctaScale = useRef(new Animated.Value(1)).current;

  const isLast = currentPage === FEATURES.length - 1;
  const currentFeature = FEATURES[currentPage];

  const goToAuth = () => navigation.replace('Auth');

  // Animate content on page change
  useEffect(() => {
    // Animate dots
    dotWidths.forEach((anim, i) => {
      Animated.spring(anim, {
        toValue: i === currentPage ? 24 : 8,
        friction: 6,
        tension: 80,
        useNativeDriver: false,
      }).start();
    });

    // Content entry animation
    contentOpacity.setValue(0);
    contentSlide.setValue(16);
    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(contentSlide, {
        toValue: 0,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentPage]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const pageWidth = event.nativeEvent.layoutMeasurement.width;
      const page = Math.round(offsetX / pageWidth);
      if (page !== currentPage && page >= 0 && page < FEATURES.length) {
        setCurrentPage(page);
      }
    },
    [currentPage],
  );

  const handleNext = () => {
    if (isLast) {
      goToAuth();
    } else {
      const nextPage = currentPage + 1;
      scrollRef.current?.scrollTo({ x: nextPage * SCREEN_WIDTH, animated: true });
    }
  };

  const handleCtaPressIn = () => {
    Animated.spring(ctaScale, {
      toValue: 0.96,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();
  };

  const handleCtaPressOut = () => {
    Animated.spring(ctaScale, {
      toValue: 1,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={styles.container}>
      {/* Per-page ambient gradient */}
      <LinearGradient
        colors={[currentFeature.gradient[0], currentFeature.gradient[1], currentFeature.gradient[2]]}
        locations={[0, 0.6, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Skip button */}
        <View style={styles.header}>
          <Pressable onPress={goToAuth} hitSlop={12} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </View>

        {/* Feature pages */}
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
          {FEATURES.map((feature, index) => (
            <View key={index} style={styles.page}>
              {/* Icon glow halo */}
              <View style={styles.iconArea}>
                <View style={[styles.iconGlow, { shadowColor: feature.accent }]}>
                  <LinearGradient
                    colors={[feature.accent + '30', feature.accent + '10', 'transparent']}
                    style={styles.iconGlowGradient}
                    start={{ x: 0.5, y: 0.5 }}
                    end={{ x: 1, y: 1 }}
                  />
                </View>
                {/* Icon ring */}
                <View
                  style={[
                    styles.iconOuterRing,
                    { borderColor: feature.accent + '4D' },
                  ]}
                >
                  <View
                    style={[
                      styles.iconCircle,
                      {
                        backgroundColor: feature.accent + '1F',
                        ...Platform.select({
                          ios: {
                            shadowColor: feature.accent,
                            shadowOffset: { width: 0, height: 0 },
                            shadowOpacity: 0.45,
                            shadowRadius: 32,
                          },
                          android: { elevation: 12 },
                        }),
                      },
                    ]}
                  >
                    <Ionicons name={feature.icon} size={56} color={feature.accent} />
                  </View>
                </View>
              </View>

              {/* Text content with entry animation */}
              <Animated.View
                style={[
                  styles.textBlock,
                  index === currentPage && {
                    opacity: contentOpacity,
                    transform: [{ translateY: contentSlide }],
                  },
                ]}
              >
                {/* Accent rule */}
                <View style={[styles.accentRule, { backgroundColor: feature.accent }]} />

                <Text style={styles.title}>{feature.title}</Text>

                <AccentDescription
                  text={feature.description}
                  accentWord={feature.accentWord}
                  accentColor={feature.accent}
                />
              </Animated.View>
            </View>
          ))}
        </ScrollView>

        {/* Footer: dots left, CTA right */}
        <View style={styles.footer}>
          {/* Expanding dots */}
          <View style={styles.dotsRow}>
            {FEATURES.map((_, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.dot,
                  {
                    width: dotWidths[i],
                    backgroundColor: i === currentPage ? currentFeature.accent : colors.dotInactive,
                  },
                ]}
              />
            ))}
          </View>

          {/* CTA Button */}
          <Animated.View
            style={[
              isLast ? styles.ctaFullWidth : styles.ctaPill,
              { transform: [{ scale: ctaScale }] },
            ]}
          >
            <Pressable
              onPress={handleNext}
              onPressIn={handleCtaPressIn}
              onPressOut={handleCtaPressOut}
              style={styles.ctaPressable}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryBright]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={[
                  styles.ctaGradient,
                  isLast ? styles.ctaGradientFull : styles.ctaGradientPill,
                ]}
              >
                <Text style={styles.ctaText}>
                  {isLast ? 'Get Started' : 'Next'}
                </Text>
                <Ionicons
                  name={isLast ? 'arrow-forward' : 'chevron-forward'}
                  size={18}
                  color="#fff"
                />
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    alignItems: 'flex-end',
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 8,
    paddingBottom: 4,
  },
  skipButton: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  skipText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
  scrollView: {
    flex: 1,
  },
  page: {
    width: SCREEN_WIDTH,
    paddingHorizontal: 28,
    paddingTop: 40,
  },
  iconArea: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
    marginBottom: 36,
  },
  iconGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    overflow: 'hidden',
  },
  iconGlowGradient: {
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  iconOuterRing: {
    width: 144,
    height: 144,
    borderRadius: 72,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 16,
  },
  accentRule: {
    width: 40,
    height: 2,
    borderRadius: 1,
    opacity: 0.9,
    marginBottom: 4,
  },
  title: {
    fontFamily: fonts.titleRegular,
    fontSize: 44,
    color: colors.textPrimary,
    textAlign: 'center',
    letterSpacing: 1.5,
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
    letterSpacing: 0.3,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 28,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  ctaPill: {
    // Pill shape for Next
  },
  ctaFullWidth: {
    flex: 1,
    marginLeft: 24,
  },
  ctaPressable: {
    overflow: 'hidden',
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: touchTarget.button,
    gap: 6,
  },
  ctaGradientPill: {
    width: 120,
    borderRadius: 26,
  },
  ctaGradientFull: {
    borderRadius: 14,
    paddingHorizontal: 24,
  },
  ctaText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: '#fff',
    letterSpacing: 0.5,
  },
});
