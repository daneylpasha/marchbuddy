import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts } from '../../theme';
import type { IntroStackParamList } from '../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<IntroStackParamList, 'Welcome'>;

const AUTO_ADVANCE_MS = 3000;

export default function WelcomeScreen() {
  const navigation = useNavigation<Nav>();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasNavigated = useRef(false);

  // Staggered animation values
  const glowAnim = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0.85)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(20)).current;
  const subtitleAnim = useRef(new Animated.Value(0)).current;
  const hintAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.35)).current;

  const advance = () => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    navigation.replace('FeatureOnboarding');
  };

  useEffect(() => {
    // Staggered reveal sequence
    Animated.sequence([
      // t=0: glow halo fades in
      Animated.timing(glowAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // t=200: icon materializes (runs after glow starts, with overlap via delay trick)
    ]).start();

    // Icon: starts 200ms after glow begins
    Animated.parallel([
      Animated.timing(iconOpacity, {
        toValue: 1,
        duration: 500,
        delay: 200,
        useNativeDriver: true,
      }),
      Animated.timing(iconScale, {
        toValue: 1,
        duration: 500,
        delay: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Title: 400ms
    Animated.parallel([
      Animated.timing(titleAnim, {
        toValue: 1,
        duration: 500,
        delay: 400,
        useNativeDriver: true,
      }),
      Animated.timing(titleSlide, {
        toValue: 0,
        duration: 500,
        delay: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Subtitle: 600ms
    Animated.timing(subtitleAnim, {
      toValue: 1,
      duration: 400,
      delay: 600,
      useNativeDriver: true,
    }).start();

    // Hint: 1200ms
    Animated.timing(hintAnim, {
      toValue: 1,
      duration: 400,
      delay: 1200,
      useNativeDriver: true,
    }).start();

    // Pulse loop for hint dot
    setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.35,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }, 1200);

    // Auto-advance
    timerRef.current = setTimeout(advance, AUTO_ADVANCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Pressable style={styles.container} onPress={advance}>
      {/* Ambient green tint gradient */}
      <LinearGradient
        colors={['#0D1F15', '#0A0A0A', '#0A0A0A']}
        locations={[0, 0.4, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.content}>
          {/* Glow halo behind icon */}
          <Animated.View style={[styles.glowHalo, { opacity: glowAnim }]}>
            <LinearGradient
              colors={['rgba(16,185,129,0.18)', 'rgba(16,185,129,0.06)', 'transparent']}
              style={styles.glowGradient}
              start={{ x: 0.5, y: 0.5 }}
              end={{ x: 1, y: 1 }}
            />
          </Animated.View>

          {/* Icon with glow ring */}
          <Animated.View
            style={[
              styles.iconWrapper,
              {
                opacity: iconOpacity,
                transform: [{ scale: iconScale }],
              },
            ]}
          >
            <Image
              source={require('../../../assets/icon.png')}
              style={styles.icon}
              resizeMode="contain"
            />
          </Animated.View>

          {/* Title */}
          <Animated.Text
            style={[
              styles.title,
              {
                opacity: titleAnim,
                transform: [{ translateY: titleSlide }],
              },
            ]}
          >
            MARCH BUDDY
          </Animated.Text>

          {/* Subtitle with accent word */}
          <Animated.View style={{ opacity: subtitleAnim }}>
            <Text style={styles.subtitle}>
              Your <Text style={styles.accentWord}>AI-powered</Text> running coach.
              {'\n'}Start walking. Start running. Transform.
            </Text>
          </Animated.View>
        </View>

        {/* Pulsing hint */}
        <Animated.View style={[styles.hint, { opacity: hintAnim }]}>
          <Animated.View style={[styles.pulseDot, { opacity: pulseAnim }]} />
          <Text style={styles.hintText}>Tap anywhere to continue</Text>
        </Animated.View>
      </SafeAreaView>
    </Pressable>
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
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  glowHalo: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    overflow: 'hidden',
  },
  glowGradient: {
    width: 280,
    height: 280,
    borderRadius: 140,
  },
  iconWrapper: {
    width: 144,
    height: 144,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    ...Platform.select({
      ios: {
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 24,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  icon: {
    width: 140,
    height: 140,
    borderRadius: 32,
  },
  title: {
    fontFamily: fonts.titleRegular,
    fontSize: 52,
    color: colors.textPrimary,
    letterSpacing: 3,
    marginBottom: 12,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
    letterSpacing: 0.4,
  },
  accentWord: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
  },
  hint: {
    paddingBottom: 32,
    alignItems: 'center',
    gap: 8,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  hintText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textTertiary,
    letterSpacing: 0.3,
  },
});
