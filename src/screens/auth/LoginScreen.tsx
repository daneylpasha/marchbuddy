import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { authService } from '../../services/authService';
import { useCoachSetupStore } from '../../store/coachSetupStore';
import { colors, fonts } from '../../theme';

export default function LoginScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const userName = useCoachSetupStore((s) => s.setupData.userName);

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      const result = await authService.signInWithGoogleOAuth();
      if (!result.success && result.error !== 'Sign in cancelled') {
        Alert.alert('Sign In Failed', result.error || 'Please try again.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
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
              Great job,{'\n'}{userName || 'there'}!
            </Text>
            <Text style={styles.subtitle}>
              Let's save your progress so you never lose it
            </Text>
          </View>

          <View style={styles.spacer} />

          <View style={styles.signInSection}>
            <Text style={styles.signInLabel}>
              Continue with your Google account
            </Text>

            <TouchableOpacity
              style={[
                styles.googleButton,
                isLoading && styles.buttonDisabled,
              ]}
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

            <Text style={styles.privacyText}>
              By signing in, you agree to our Terms of Service and Privacy Policy
            </Text>
          </View>
        </View>
      </SafeAreaView>
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
  privacyText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
});
