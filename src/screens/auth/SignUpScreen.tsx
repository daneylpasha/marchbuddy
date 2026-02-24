import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuthStore } from '../../store/authStore';
import type { AuthStackParamList } from '../../navigation/AppNavigator';
import { colors, fonts } from '../../theme';
import BebasText from '../../components/common/BebasText';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

export default function SignUpScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const { signUp, isLoading } = useAuthStore();

  const handleSignUp = async () => {
    setError('');
    if (!email || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    try {
      await signUp(email.trim(), password);
    } catch (e: any) {
      setError(e.message ?? 'Sign up failed. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#021f05', '#000000']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.inner}>
        <BebasText style={styles.title}>Create Account</BebasText>
        <Text style={styles.subtitle}>Start your fitness journey</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.textTertiary}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!isLoading}
          accessibilityLabel="Email address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.textTertiary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!isLoading}
          accessibilityLabel="Password"
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm Password"
          placeholderTextColor={colors.textTertiary}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          editable={!isLoading}
          accessibilityLabel="Confirm password"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={styles.button}
          onPress={handleSignUp}
          disabled={isLoading}
          accessibilityRole="button"
          accessibilityLabel="Create account"
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Create Account</Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate('Login')}
          disabled={isLoading}
          accessibilityRole="button"
          accessibilityLabel="Go to sign in"
        >
          <Text style={styles.link}>Already have an account? Sign In</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  title: { textAlign: 'center' as const, marginBottom: 4 },
  subtitle: { fontSize: 16, color: colors.textSecondary, textAlign: 'center', marginBottom: 32, fontFamily: fonts.regular, letterSpacing: 0.3 },
  input: {
    borderWidth: 1,
    borderColor: colors.dotInactive,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 12,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
  },
  error: { color: colors.danger, fontSize: 14, marginBottom: 12, textAlign: 'center', fontFamily: fonts.regular, letterSpacing: 0.3 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600', fontFamily: fonts.bold, letterSpacing: 0.3 },
  link: { color: colors.primary, textAlign: 'center', fontSize: 14, fontFamily: fonts.medium, letterSpacing: 0.3 },
});
