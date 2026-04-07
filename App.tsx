import React, { useCallback, useEffect, useState } from 'react';
import { LogBox } from 'react-native';

LogBox.ignoreLogs([
  'FunctionsHttpError',
  'Edge Function returned a non-2xx',
  'Error calling generate-session-options',
  'Error sending chat message',
]);
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { navigationRef } from './src/navigation/navigationRef';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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
import { registerForPushNotifications, refreshPushToken } from './src/services/notificationService';
import { useAuthStore } from './src/store/authStore';
import NotificationPermissionModal from './src/components/notifications/NotificationPermissionModal';

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

  // Register/refresh push token after login (ensures token is saved to Supabase)
  useEffect(() => {
    if (isAuthenticated && !isGuest) {
      registerForPushNotifications();
    }
  }, [isAuthenticated, isGuest]);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  // Show permission modal after fonts load if we haven't asked yet
  useEffect(() => {
    if (fontsLoaded && permissionStatus === 'undetermined' && canPrompt()) {
      // Delay to let onboarding complete first
      const timer = setTimeout(() => setShowPermissionModal(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [fontsLoaded, permissionStatus, canPrompt]);

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
          </NavigationContainer>
        </BottomSheetModalProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
