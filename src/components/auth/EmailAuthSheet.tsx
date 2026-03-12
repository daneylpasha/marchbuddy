import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  Platform,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetTextInput,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { colors, fonts, spacing } from '../../theme';

type AuthMode = 'login' | 'register';

export interface EmailAuthSheetRef {
  present: () => void;
}

const EmailAuthSheet = forwardRef<EmailAuthSheetRef>((_, forwardedRef) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const modalRef = useRef<BottomSheetModal>(null);
  const scrollRef = useRef<any>(null);
  const { signIn, signUp, isLoading } = useAuthStore();

  const snapPoints = useMemo(() => ['48%', '88%'], []);

  useImperativeHandle(forwardedRef, () => ({
    present: () => modalRef.current?.present(),
  }));

  // Track keyboard and auto-snap
  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: any) => {
      setKeyboardHeight(e.endCoordinates.height);
      modalRef.current?.snapToIndex(1);
    };
    const onHide = () => {
      setKeyboardHeight(0);
      modalRef.current?.snapToIndex(0);
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const resetForm = useCallback(() => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setSuccessMessage('');
    setShowPassword(false);
    setKeyboardHeight(0);
  }, []);

  const handleDismiss = useCallback(() => {
    Keyboard.dismiss();
    resetForm();
  }, [resetForm]);

  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === 'login' ? 'register' : 'login'));
    setError('');
    setSuccessMessage('');
    setConfirmPassword('');
  }, []);

  const validate = (): boolean => {
    if (!email.trim()) {
      setError('Please enter your email address.');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return false;
    }
    if (!password) {
      setError('Please enter your password.');
      return false;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return false;
    }
    if (mode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    setError('');
    setSuccessMessage('');

    if (!validate()) return;

    Keyboard.dismiss();

    try {
      if (mode === 'login') {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password);
        const session = useAuthStore.getState().session;
        if (!session) {
          setSuccessMessage(
            'Account created! Check your email to confirm, then sign in.',
          );
          setMode('login');
          setPassword('');
          setConfirmPassword('');
        }
      }
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong. Please try again.');
    }
  };

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.6}
        pressBehavior="close"
      />
    ),
    [],
  );

  // Scroll to a y offset when input focuses (so it's visible above keyboard)
  const scrollToInput = (yOffset: number) => {
    if (keyboardHeight > 0 || Platform.OS === 'android') {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: yOffset, animated: true });
      }, 150);
    }
  };

  const isLogin = mode === 'login';

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
    >
      <BottomSheetScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.content,
          keyboardHeight > 0 && { paddingBottom: keyboardHeight },
        ]}
        bounces={false}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.title}>
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </Text>
        <Text style={styles.subtitle}>
          {isLogin
            ? 'Sign in with your email and password'
            : 'Start your fitness journey today'}
        </Text>

        {/* Success message */}
        {successMessage ? (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={18} color="#34D399" />
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        ) : null}

        {/* Error message */}
        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Email input */}
        <View style={styles.inputWrapper}>
          <Ionicons
            name="mail-outline"
            size={20}
            color={colors.textTertiary}
            style={styles.inputIcon}
          />
          <BottomSheetTextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor={colors.textTertiary}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setError('');
            }}
            onFocus={() => scrollToInput(0)}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            editable={!isLoading}
          />
        </View>

        {/* Password input */}
        <View style={styles.inputWrapper}>
          <Ionicons
            name="lock-closed-outline"
            size={20}
            color={colors.textTertiary}
            style={styles.inputIcon}
          />
          <BottomSheetTextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Password"
            placeholderTextColor={colors.textTertiary}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setError('');
            }}
            onFocus={() => scrollToInput(80)}
            secureTextEntry={!showPassword}
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            editable={!isLoading}
          />
          <TouchableOpacity
            onPress={() => setShowPassword((prev) => !prev)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.eyeButton}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textTertiary}
            />
          </TouchableOpacity>
        </View>

        {/* Confirm password (register only) */}
        {!isLogin && (
          <View style={styles.inputWrapper}>
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={colors.textTertiary}
              style={styles.inputIcon}
            />
            <BottomSheetTextInput
              style={styles.input}
              placeholder="Confirm password"
              placeholderTextColor={colors.textTertiary}
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                setError('');
              }}
              onFocus={() => scrollToInput(140)}
              secureTextEntry={!showPassword}
              autoComplete="new-password"
              editable={!isLoading}
            />
          </View>
        )}

        {/* CTA Button */}
        <TouchableOpacity
          style={[styles.ctaButton, isLoading && styles.ctaDisabled]}
          onPress={handleSubmit}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.ctaText}>
              {isLogin ? 'Sign In' : 'Create Account'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Toggle mode */}
        <TouchableOpacity
          onPress={toggleMode}
          disabled={isLoading}
          activeOpacity={0.7}
          style={styles.toggleButton}
        >
          <Text style={styles.toggleText}>
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <Text style={styles.toggleHighlight}>
              {isLogin ? 'Register' : 'Sign In'}
            </Text>
          </Text>
        </TouchableOpacity>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

EmailAuthSheet.displayName = 'EmailAuthSheet';

export default EmailAuthSheet;

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handleIndicator: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 40,
  },
  content: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  title: {
    fontFamily: fonts.titleRegular,
    fontSize: 36,
    color: '#FFFFFF',
    marginBottom: 6,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
    letterSpacing: 0.3,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(52,211,153,0.1)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  successText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: '#34D399',
    flex: 1,
    letterSpacing: 0.3,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.dangerDim,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.danger,
    flex: 1,
    letterSpacing: 0.3,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 16 : 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: '#FFFFFF',
    padding: 0,
    margin: 0,
    lineHeight: 20,
    textAlignVertical: 'center',
    letterSpacing: 0.3,
  },
  eyeButton: {
    paddingLeft: 8,
  },
  ctaButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  ctaDisabled: {
    opacity: 0.5,
  },
  ctaText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: '#000000',
    letterSpacing: 0.5,
  },
  toggleButton: {
    paddingBottom: 4,
  },
  toggleText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textTertiary,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  toggleHighlight: {
    fontFamily: fonts.semiBold,
    color: '#FFFFFF',
  },
});
