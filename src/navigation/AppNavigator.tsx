import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useCoachSetupStore } from '../store/coachSetupStore';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { useActiveSessionStore, isSessionStale } from '../store/activeSessionStore';
import WelcomeScreen from '../screens/onboarding/WelcomeScreen';
import FeatureOnboardingScreen from '../screens/onboarding/FeatureOnboardingScreen';
import CoachSetupScreen from '../screens/onboarding/CoachSetupScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import MainTabNavigator from './MainTabNavigator';
import SplashAnimated from '../screens/splash/SplashAnimated';

const restoreIconSource = require('../../assets/splash-logo-transparent.png');

// Static splash-styled screen shown while server state is re-hydrating after a
// mid-session sign-in. Prevents the brief flash of the name/coach-setup screen
// caused by `setupComplete` not yet being restored from the server.
function RestoringSessionView() {
  return (
    <View style={restoreStyles.container}>
      <LinearGradient
        colors={['transparent', 'transparent', '#1a1a1a', '#212020']}
        locations={[0, 0.6, 0.85, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Image source={restoreIconSource} style={restoreStyles.icon} resizeMode="contain" />
    </View>
  );
}

const restoreStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    width: 350,
    height: 350,
  },
});

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
  const [isActiveSessionHydrated, setIsActiveSessionHydrated] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [splashGone, setSplashGone] = useState(false);
  const minTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setupComplete = useCoachSetupStore((s) => s.setupComplete);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isRestoringSession = useAuthStore((s) => s.isRestoringSession);
  const hasSeenIntro = useSettingsStore((s) => s.hasSeenIntro);
  const pendingSignInConflict = useAuthStore((s) => s.pendingSignInConflict);

  // Surface sign-in conflict (guest data exists + the email being signed
  // into already has an account on the server) as a top-level confirmation.
  // The user picks one of two paths:
  //   • Use Existing Account → restore previous data, abandon guest progress
  //   • Keep Guest           → cancel sign-in, stay in guest session
  // Both paths land on a coherent state via the dedicated store actions.
  useEffect(() => {
    if (!pendingSignInConflict) return;
    Alert.alert(
      'Account Already Registered',
      'This email already has an account. What would you like to do?\n\n' +
        '• Use Existing Account — your previous progress will be restored. ' +
        'Your current guest session will be discarded.\n\n' +
        '• Keep Guest — cancel this sign-in and stay in guest mode with ' +
        'your current progress.',
      [
        {
          text: 'Keep Guest',
          style: 'cancel',
          onPress: () => useAuthStore.getState().resolveConflictKeepGuest(),
        },
        {
          text: 'Use Existing Account',
          style: 'destructive',
          onPress: () => useAuthStore.getState().resolveConflictUseExistingAccount(),
        },
      ],
      { cancelable: false },
    );
  }, [pendingSignInConflict]);

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

  // Wait for activeSessionStore to hydrate before mounting RunNavigator —
  // its initialRouteName decision depends on the persisted isActive flag.
  // Also drop sessions that have been sitting stale beyond the threshold
  // BEFORE we mark hydration complete, so the navigator never sees them.
  useEffect(() => {
    const handleHydrated = () => {
      const state = useActiveSessionStore.getState();
      if (state.isActive && isSessionStale(state)) {
        state.resetSession();
      }
      setIsActiveSessionHydrated(true);

      // If there's a live session in progress, skip the minimum splash wait —
      // the user needs to get back to their session immediately, not sit
      // through 3 seconds of branding after a background process kill.
      if (state.isActive && state.plan) {
        if (minTimerRef.current) clearTimeout(minTimerRef.current);
        setMinTimeElapsed(true);
      }
    };

    if (useActiveSessionStore.persist.hasHydrated()) {
      handleHydrated();
      return;
    }
    const unsub = useActiveSessionStore.persist.onFinishHydration(handleHydrated);
    return unsub;
  }, []);

  // Initialize auth — restores Supabase session and sets up auth state listener
  useEffect(() => {
    useAuthStore.getState().initialize().finally(() => {
      setIsAuthReady(true);
    });
  }, []);

  // Splash starts hiding only when all stores hydrated + auth ready + min time
  // + server state restored. Blocks dismissal during the restore window at
  // cold-start so we never flash the name screen before setupComplete rehydrates.
  const splashHiding =
    isHydrated &&
    isSettingsHydrated &&
    isActiveSessionHydrated &&
    isAuthReady &&
    minTimeElapsed &&
    !isRestoringSession;

  if (!splashGone) {
    return (
      <SplashAnimated
        hiding={splashHiding}
        onHidden={() => setSplashGone(true)}
      />
    );
  }

  // Mid-session sign-in: block navigation decisions until server state restores
  // so we don't briefly render the coach-setup (name) screen before setupComplete
  // is re-hydrated from the server.
  if (isAuthenticated && isRestoringSession) {
    return <RestoringSessionView />;
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
