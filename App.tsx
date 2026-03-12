import React, { useEffect } from 'react';
import { LogBox } from 'react-native';

LogBox.ignoreLogs([
  'FunctionsHttpError',
  'Edge Function returned a non-2xx',
  'Error calling generate-session-options',
  'Error sending chat message',
]);
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
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

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: 'black' }}>
      <ErrorBoundary>
        <BottomSheetModalProvider>
          <NavigationContainer theme={NAV_THEME}>
            <StatusBar style="light" backgroundColor="#000000" translucent={true} />
            <AppNavigator />
          </NavigationContainer>
        </BottomSheetModalProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
