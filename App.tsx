import React, { useCallback, useEffect, useState } from 'react';
import { LogBox } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { navigationRef } from './src/navigation/navigationRef';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import {
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
} from '@expo-google-fonts/montserrat';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import ErrorBoundary from './src/components/common/ErrorBoundary';
import AppNavigator from './src/navigation/AppNavigator';
import { useNotificationListener } from './src/hooks/useNotificationListener';
import { useNotificationStore } from './src/store/notificationStore';
import { registerForPushNotifications } from './src/services/notificationService';
import { useNotificationPrefsStore } from './src/store/notificationPrefsStore';
import { useAuthStore } from './src/store/authStore';
import { useNetworkStore } from './src/store/networkStore';
import { offlineQueue } from './src/services/offlineQueue';
import { registerOfflineActions } from './src/services/offlineActions';
import { offlineCache } from './src/services/offlineCache';
import NotificationPermissionModal from './src/components/notifications/NotificationPermissionModal';
import AppDialogHost from './src/components/common/AppDialogHost';
import { analytics, EVENTS } from './src/services/analytics';
import { purchasesService } from './src/services/purchasesService';

LogBox.ignoreLogs([
  'FunctionsHttpError',
  'Edge Function returned a non-2xx',
  'Error calling generate-session-options',
  'Error sending chat message',
  'Failed to generate coach reply',
  'LayoutAnimationEnabledExperimental',
  // PostHog batches events and retries on failure. Transient network errors
  // (offline, captive portal, slow Wi-Fi) surface as a redbox "Error while
  // flushing PostHog" in dev — non-fatal, but disruptive while testing.
  // Analytics already swallows these via the .on('error') hook; this just
  // silences PostHog's internal console.error so LogBox stays quiet.
  'Error while flushing PostHog',
  'PostHogFetchNetworkError',
]);

// PostHog's posthog-react-native SDK calls console.error directly when a
// flush fails, which also surfaces in the Metro terminal regardless of
// LogBox. The retries happen automatically and queued events are flushed
// when the network comes back, so these messages are pure noise. Filter
// them at the console layer too. Keep the filter narrow — only matching
// substrings, not blanket-suppressing console.error.
const POSTHOG_NOISE = ['PostHogFetchNetworkError', 'Error while flushing PostHog'];

// RevenueCat logs at ERROR level when Google Play Billing isn't available —
// which is always the case on Android emulators without Play Services + a
// signed-in Play Store account. Real devices in production have Play Store,
// so this error never fires there. Filter ONLY in dev to keep the emulator
// console clean; in production we always surface real billing errors.
const RC_DEV_NOISE = __DEV__
  ? [
      'BILLING_UNAVAILABLE',
      'Billing is not available in this device',
      'Billing service unavailable on device',
    ]
  : [];

// Supabase auth-js logs this internally (GoTrueClient._recoverAndRefresh)
// when the persisted session's refresh token was revoked server-side. It is
// an expected lifecycle event, not a bug: the library removes the stale
// session and authStore.initialize routes the user to a clean login screen.
const SUPABASE_AUTH_NOISE = ['Invalid Refresh Token'];

const originalConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  const first = args[0];
  const firstStr =
    typeof first === 'string' ? first : first instanceof Error ? first.message : '';
  if (POSTHOG_NOISE.some((needle) => firstStr.includes(needle))) return;
  if (SUPABASE_AUTH_NOISE.some((needle) => firstStr.includes(needle))) return;
  if (RC_DEV_NOISE.some((needle) => firstStr.includes(needle))) return;
  // Also check across all args — RC sometimes splits message + payload
  if (__DEV__ && args.length > 1) {
    const joined = args
      .map((a) => (typeof a === 'string' ? a : a instanceof Error ? a.message : ''))
      .join(' ');
    if (RC_DEV_NOISE.some((needle) => joined.includes(needle))) return;
  }
  originalConsoleError(...args);
};

const NAV_THEME = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: 'black',
    card: 'black',
    border: 'rgba(255,255,255,0.06)',
    primary: '#068a15',
    text: '#FFFFFF',
    notification: '#068a15',
  },
};

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded] = useFonts({
    BebasNeue_400Regular,
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
  });

  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const permissionStatus = useNotificationStore((s) => s.permissionStatus);
  const canPrompt = useNotificationStore((s) => s.canPromptPermission);
  const setLastPermissionPrompt = useNotificationStore((s) => s.setLastPermissionPrompt);

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isGuest = useAuthStore((s) => s.isGuest);

  // Notification tap listener
  useNotificationListener();

  // Initialize offline support
  useEffect(() => {
    registerOfflineActions();
    offlineQueue.startListening();
    offlineCache.clearExpired();
    const unsubNetwork = useNetworkStore.getState().startListening();
    return () => {
      offlineQueue.stopListening();
      unsubNetwork();
    };
  }, []);

  // Boot analytics on a microtask so it never races the splash transition
  // or font loader. Events fired before init completes are buffered in
  // analytics.queue and replayed after init resolves, so deferring by one
  // tick has zero functional cost. We wrap in setTimeout(0) so any
  // PostHog-internal fetch failures (e.g. dev simulator offline) surface
  // *after* the splash has had a chance to hide.
  useEffect(() => {
    const t = setTimeout(() => {
      analytics
        .init()
        .then(() => {
          analytics.track(EVENTS.app_opened);
        })
        .catch(() => {
          /* analytics never breaks the app */
        });
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // Initialize RevenueCat SDK once at startup. Same defer-by-one-tick
  // pattern as analytics — RC's internal SDK setup involves network calls
  // (fetching offerings, customer info) that shouldn't race the splash.
  // The SDK quietly no-ops if no API key is configured for this platform,
  // so this is safe to run unconditionally even in dev environments
  // without an RC key.
  useEffect(() => {
    const t = setTimeout(() => {
      purchasesService.configure().catch(() => {
        /* purchases never breaks the app */
      });
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // Register/refresh push token after login (ensures token is saved to Supabase)
  // and hydrate notification prefs from the server so the client can
  // pre-check them before scheduling local reminders.
  useEffect(() => {
    if (isAuthenticated && !isGuest) {
      registerForPushNotifications();
      useNotificationPrefsStore.getState().hydrateFromServer();
    }
  }, [isAuthenticated, isGuest]);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  // Show permission modal after user reaches home (past intro + setup)
  const setupComplete = require('./src/store/coachSetupStore').useCoachSetupStore(
    (s: any) => s.setupComplete,
  );
  useEffect(() => {
    if (
      fontsLoaded &&
      isAuthenticated &&
      setupComplete &&
      permissionStatus === 'undetermined' &&
      canPrompt()
    ) {
      const timer = setTimeout(() => setShowPermissionModal(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [fontsLoaded, isAuthenticated, setupComplete, permissionStatus, canPrompt]);

  const handleAllowNotifications = useCallback(async () => {
    setShowPermissionModal(false);
    await registerForPushNotifications();
  }, []);

  const handleSkipNotifications = useCallback(() => {
    setShowPermissionModal(false);
    setLastPermissionPrompt(new Date().toISOString());
  }, [setLastPermissionPrompt]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: 'black' }}>
        <ErrorBoundary>
          <BottomSheetModalProvider>
            <NavigationContainer theme={NAV_THEME} ref={navigationRef}>
              <StatusBar style="light" backgroundColor="#000000" translucent={true} />
              <AppNavigator />
              <NotificationPermissionModal
                visible={showPermissionModal}
                onAllow={handleAllowNotifications}
                onSkip={handleSkipNotifications}
              />
              <AppDialogHost />
            </NavigationContainer>
          </BottomSheetModalProvider>
        </ErrorBoundary>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
