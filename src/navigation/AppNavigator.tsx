import React, { useEffect, useRef, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useCoachSetupStore } from '../store/coachSetupStore';
import { useAuthStore } from '../store/authStore';
import CoachSetupScreen from '../screens/onboarding/CoachSetupScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import MainTabNavigator from './MainTabNavigator';
import SplashAnimated from '../screens/splash/SplashAnimated';

// ─── Param lists ─────────────────────────────────────────────────────────────

export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
};

export type OnboardingStackParamList = {
  OnboardingChat: undefined;
};

// ─── Onboarding navigator ─────────────────────────────────────────────────────

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
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [splashGone, setSplashGone] = useState(false);
  const minTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setupComplete = useCoachSetupStore((s) => s.setupComplete);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

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

  // Initialize auth — restores Supabase session and sets up auth state listener
  useEffect(() => {
    useAuthStore.getState().initialize().finally(() => {
      setIsAuthReady(true);
    });
  }, []);

  // Splash starts hiding only when all three are ready
  const splashHiding = isHydrated && isAuthReady && minTimeElapsed;

  if (!splashGone) {
    return (
      <SplashAnimated
        hiding={splashHiding}
        onHidden={() => setSplashGone(true)}
      />
    );
  }

  if (!setupComplete) {
    return <OnboardingNavigator />;
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <MainTabNavigator />;
}
