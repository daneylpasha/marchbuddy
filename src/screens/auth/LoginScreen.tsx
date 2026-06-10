import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { showAppDialog } from '../../services/appDialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { authService } from '../../services/authService';
import { useAuthStore } from '../../store/authStore';
import { colors, fonts } from '../../theme';
import EmailAuthSheet from '../../components/auth/EmailAuthSheet';
import type { EmailAuthSheetRef } from '../../components/auth/EmailAuthSheet';
import type { IntroStackParamList } from '../../navigation/AppNavigator';
import PrivacyPolicyScreen from '../settings/PrivacyPolicyScreen';
import TermsOfServiceScreen from '../settings/TermsOfServiceScreen';
import ContactSupportSheet, {
  type ContactSupportSheetRef,
} from '../../components/settings/ContactSupportSheet';

interface Props {
  navigation?: NativeStackNavigationProp<IntroStackParamList, 'Auth'>;
}

export default function LoginScreen({ navigation }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [legalScreen, setLegalScreen] = useState<'privacy' | 'terms' | null>(null);
  const enterGuestMode = useAuthStore((s) => s.enterGuestMode);
  const bottomSheetRef = useRef<EmailAuthSheetRef>(null);
  const supportSheetRef = useRef<ContactSupportSheetRef>(null);

  const isIntroFlow = !!navigation;

  // Navigation after successful sign-in is handled declaratively by
  // AppNavigator (via `isAuthenticated` + `setupComplete` + `hasSeenIntro`).
  // The old imperative `navigation.replace('CoachSetup')` here raced against
  // AppNavigator's re-render to RestoringSessionView, which was unmounting
  // this screen and swallowing the navigation call.

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      const result = await authService.signInWithGoogleOAuth();
      if (!result.success && result.error !== 'Sign in cancelled') {
        showAppDialog('Sign In Failed', result.error || 'Please try again.');
      }
    } catch (error: any) {
      showAppDialog('Error', error.message || 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenEmailAuth = useCallback(() => {
    bottomSheetRef.current?.present();
  }, []);

  const handleGuestMode = () => {
    enterGuestMode();
    // Navigation is handled declaratively by AppNavigator — it watches
    // `isAuthenticated` + `setupComplete` and renders the correct stack.
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['transparent', 'transparent', '#1a1a1a', '#2a2a2a']}
        locations={[0, 0.6, 0.85, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.greeting}>
              {isIntroFlow ? 'Welcome to\nMarch Buddy' : 'Welcome\nBack!'}
            </Text>
            <Text style={styles.subtitle}>
              {isIntroFlow
                ? 'Sign up to save your progress and unlock all features'
                : 'Sign in to continue your journey'}
            </Text>
          </View>

          <View style={styles.spacer} />

          <View style={styles.signInSection}>
            <Text style={styles.signInLabel}>Continue with your Google account</Text>

            <TouchableOpacity
              style={[styles.googleButton, isLoading && styles.buttonDisabled]}
              onPress={handleGoogleSignIn}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Ionicons name="logo-google" size={22} color="#000" />
                  <Text style={styles.googleButtonText}>Sign in with Google</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Email/password trigger */}
            <TouchableOpacity
              onPress={handleOpenEmailAuth}
              activeOpacity={0.7}
              style={styles.emailTrigger}
            >
              <Text style={styles.emailTriggerText}>I'd like to sign in with email & password</Text>
            </TouchableOpacity>

            {/* Guest mode */}
            <TouchableOpacity
              onPress={handleGuestMode}
              activeOpacity={0.7}
              style={styles.guestTrigger}
            >
              <Ionicons name="person-outline" size={16} color={colors.textTertiary} />
              <Text style={styles.guestTriggerText}>Skip for now — explore as guest</Text>
            </TouchableOpacity>

            <Text style={styles.privacyText}>
              By signing in, you accept our terms below.
            </Text>

            <View style={styles.legalRow}>
              <TouchableOpacity
                onPress={() => setLegalScreen('terms')}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                accessibilityRole="link"
                accessibilityLabel="Terms of Service"
              >
                <Text style={styles.legalLink}>Terms of Service</Text>
              </TouchableOpacity>
              <Text style={styles.legalSeparator}>·</Text>
              <TouchableOpacity
                onPress={() => setLegalScreen('privacy')}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                accessibilityRole="link"
                accessibilityLabel="Privacy Policy"
              >
                <Text style={styles.legalLink}>Privacy Policy</Text>
              </TouchableOpacity>
              <Text style={styles.legalSeparator}>·</Text>
              <TouchableOpacity
                onPress={() => supportSheetRef.current?.present()}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel="Contact Support"
              >
                <Text style={styles.legalLink}>Support</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>

      {/* Email auth bottom sheet */}
      <EmailAuthSheet ref={bottomSheetRef} />

      <Modal
        visible={legalScreen === 'privacy'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setLegalScreen(null)}
      >
        <PrivacyPolicyScreen onClose={() => setLegalScreen(null)} />
      </Modal>

      <Modal
        visible={legalScreen === 'terms'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setLegalScreen(null)}
      >
        <TermsOfServiceScreen onClose={() => setLegalScreen(null)} />
      </Modal>

      <ContactSupportSheet ref={supportSheetRef} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
  },
  greeting: {
    fontFamily: fonts.titleRegular,
    fontSize: 52,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 52,
    marginBottom: 16,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  spacer: {
    flex: 1,
  },
  signInSection: {
    alignItems: 'center',
  },
  signInLabel: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    gap: 12,
    width: '100%',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  googleButtonText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: '#000000',
  },
  emailTrigger: {
    marginTop: 20,
    paddingVertical: 8,
  },
  emailTriggerText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.primary,
    textDecorationLine: 'underline',
    letterSpacing: 0.3,
  },
  guestTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  guestTriggerText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textTertiary,
    letterSpacing: 0.3,
  },
  privacyText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    flexWrap: 'wrap',
    gap: 4,
  },
  legalLink: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.primary,
    letterSpacing: 0.2,
  },
  legalSeparator: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textTertiary,
    marginHorizontal: 2,
  },
});
