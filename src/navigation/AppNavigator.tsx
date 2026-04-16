import React, { useEffect, useRef, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useCoachSetupStore } from '../store/coachSetupStore';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import WelcomeScreen from '../screens/onboarding/WelcomeScreen';
import FeatureOnboardingScreen from '../screens/onboarding/FeatureOnboardingScreen';
import CoachSetupScreen from '../screens/onboarding/CoachSetupScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import MainTabNavigator from './MainTabNavigator';
import SplashAnimated from '../screens/splash/SplashAnimated';

// ─── Param lists ─────────────────────────────────────────────────────────────

export type IntroStackParamList = {
  Welcome: undefined;
  FeatureOnboarding: undefined;
  Auth: undefined;
  CoachSetup: undefined;
};

export type OnboardingStackParamList = {
  OnboardingChat: undefined;
};

// ─── Intro navigator (first-time users) ──────────────────────────────────────

const IntroStack = createNativeStackNavigator<IntroStackParamList>();

function IntroNavigator() {
  return (
    <IntroStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <IntroStack.Screen name="Welcome" component={WelcomeScreen} />
      <IntroStack.Screen name="FeatureOnboarding" component={FeatureOnboardingScreen} />
      <IntroStack.Screen name="Auth" component={LoginScreen} />
      <IntroStack.Screen name="CoachSetup" component={CoachSetupScreen} />
    </IntroStack.Navigator>
  );
}

// ─── Onboarding navigator (authenticated but setup incomplete) ───────────────

const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();

function OnboardingNavigator() {
  return (
    <OnboardingStack.Navigator screenOptions={{ headerShown: false }}>
      <OnboardingStack.Screen name="OnboardingChat" component={CoachSetupScreen} />
    </OnboardingStack.Navigator>
  );
}

// ─── Root navigator ──────────────────────────────────────────────────────────

const SPLASH_MIN_MS = 3000;

export default function AppNavigator() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSettingsHydrated, setIsSettingsHydrated] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [splashGone, setSplashGone] = useState(false);
  const minTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setupComplete = useCoachSetupStore((s) => s.setupComplete);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasSeenIntro = useSettingsStore((s) => s.hasSeenIntro);

  // Minimum splash display time
  useEffect(() => {
    minTimerRef.current = setTimeout(() => setMinTimeElapsed(true), SPLASH_MIN_MS);
    return () => {
      if (minTimerRef.current) clearTimeout(minTimerRef.current);
    };
  }, []);

  // Wait for coachSetupStore to hydrate from AsyncStorage
  useEffect(() => {
    if (useCoachSetupStore.persist.hasHydrated()) {
      setIsHydrated(true);
      return;
    }
    const unsub = useCoachSetupStore.persist.onFinishHydration(() => {
      setIsHydrated(true);
    });
    return unsub;
  }, []);

  // Wait for settingsStore to hydrate from AsyncStorage
  useEffect(() => {
    if (useSettingsStore.persist.hasHydrated()) {
      setIsSettingsHydrated(true);
      return;
    }
    const unsub = useSettingsStore.persist.onFinishHydration(() => {
      setIsSettingsHydrated(true);
    });
    return unsub;
  }, []);

  // Initialize auth — restores Supabase session and sets up auth state listener
  useEffect(() => {
    useAuthStore.getState().initialize().finally(() => {
      setIsAuthReady(true);
    });
  }, []);

  // Splash starts hiding only when all stores hydrated + auth ready + min time
  const splashHiding = isHydrated && isSettingsHydrated && isAuthReady && minTimeElapsed;

  if (!splashGone) {
    return (
      <SplashAnimated
        hiding={splashHiding}
        onHidden={() => setSplashGone(true)}
      />
    );
  }

  // First-time user: show welcome → feature onboarding → auth → coach setup
  if (!hasSeenIntro) {
    return <IntroNavigator />;
  }

  // Returning user who is not authenticated: show login screen directly
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  // Authenticated/guest but hasn't completed coach setup questions
  if (!setupComplete) {
    return <OnboardingNavigator />;
  }

  // Main app
  return <MainTabNavigator />;
}
