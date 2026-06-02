import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import ConfirmDialog from '../../components/common/ConfirmDialog';
import { analytics, EVENTS } from '../../services/analytics';
import {
  acceptRequest,
  cancelRequest,
  declineRequest,
  getMyBuddyCode,
  getMyBuddyConnection,
  lookupUserByCode,
  removeBuddy,
  sendBuddyRequest,
  subscribeToBuddyConnection,
  type BuddyConnectionState,
} from '../../services/buddyConnectionService';
import { supabase } from '../../api/supabase';
import { useNetworkStore } from '../../store/networkStore';
import { useProfileStore } from '../../store/profileStore';
import { colors, fonts, spacing } from '../../theme';
import BuddyCodeCard from './components/BuddyCodeCard';
import BuddyStateHeader from './components/BuddyStateHeader';

// ─── Types ────────────────────────────────────────────────────────────────────

type ScreenState = 'loading' | 'no_buddy' | 'pending_sent' | 'pending_received' | 'active';

const POLL_INTERVAL_MS = 30_000;

// ─── Component ────────────────────────────────────────────────────────────────

export default function BuddyScreen() {
  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [buddyCode, setBuddyCode] = useState<string | null>(null);
  const [connection, setConnection] = useState<BuddyConnectionState>({ status: 'none' });

  // Code input state
  const [inputCode, setInputCode] = useState('');
  const [inputError, setInputError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Remove buddy confirmation modal
  const [removeBuddyVisible, setRemoveBuddyVisible] = useState(false);
  const [removingBuddy, setRemovingBuddy] = useState(false);

  // Track keyboard so we can add bottom slack to the ScrollView only while
  // the keyboard is open — avoids a permanent dead zone at the bottom.
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Used to scroll the focused code input above the keyboard on Android
  // (where ScrollView doesn't auto-scroll to a focused TextInput).
  const scrollViewRef = useRef<ScrollView>(null);
  const handleInputFocus = useCallback(() => {
    // Wait for the keyboard animation + padding update to commit, then
    // scroll to the bottom so the input + Connect button sit above it.
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 120);
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates?.height ?? 0);
      // Once the padding has expanded, scroll to the bottom so the focused
      // input + Connect button sit comfortably above the keyboard.
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 50);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const myName = useProfileStore((s) => s.profile?.name ?? '');
  const isConnected = useNetworkStore((s) => s.isConnected);

  // Track the *visible* state so we can animate transitions when realtime
  // events fire while the user is on-screen.
  const previousStateRef = useRef<ScreenState>('loading');
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const load = useCallback(async () => {
    const [code, conn] = await Promise.all([getMyBuddyCode(), getMyBuddyConnection()]);
    setBuddyCode(code);
    setConnection(conn);

    let next: ScreenState;
    switch (conn.status) {
      case 'none':
        next = 'no_buddy';
        break;
      case 'pending_sent':
        next = 'pending_sent';
        break;
      case 'pending_received':
        next = 'pending_received';
        break;
      case 'active':
        next = 'active';
        break;
    }

    const prev = previousStateRef.current;
    previousStateRef.current = next;

    // Animate the swap if we're moving between *visible* states (not from loading).
    if (prev !== 'loading' && prev !== next) {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 140,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    }

    setScreenState(next);
  }, [fadeAnim]);

  // Initial load + analytics
  useEffect(() => {
    analytics.track(EVENTS.buddy_code_viewed);
    void load();
  }, [load]);

  // Realtime subscription + polling fallback
  useEffect(() => {
    let unsubscribeRealtime: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getUser();
      const userId = data?.user?.id;
      if (cancelled || !userId) return;

      const sub = subscribeToBuddyConnection(userId, () => {
        void load();
      });
      unsubscribeRealtime = sub.unsubscribe;
    })();

    // Belt-and-suspenders polling — silently catches any missed realtime events
    // (reconnects, transient failures). Cheap because each poll is two small reads.
    const pollHandle = setInterval(() => {
      void load();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      unsubscribeRealtime?.();
      clearInterval(pollHandle);
    };
  }, [load]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handleSubmitCode = async () => {
    const trimmed = inputCode.trim().toUpperCase();
    if (trimmed.length !== 6) {
      setInputError('Please enter a 6-character code');
      return;
    }

    setInputError('');
    setSubmitting(true);

    try {
      const found = await lookupUserByCode(trimmed);
      if (!found) {
        setInputError('No user found with that code, or they have disabled buddy connections');
        return;
      }

      const result = await sendBuddyRequest(found.id);
      if (!result.success) {
        setInputError(result.error ?? 'Could not send request');
        return;
      }

      analytics.track(EVENTS.buddy_request_sent);
      setInputCode('');
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!connection.connectionId) return;
    await cancelRequest(connection.connectionId);
    await load();
  };

  const handleAccept = async () => {
    if (!connection.connectionId || !connection.buddy?.id) return;
    await acceptRequest(connection.connectionId, connection.buddy.id);
    analytics.track(EVENTS.buddy_request_accepted);
    await load();
  };

  const handleDecline = async () => {
    if (!connection.connectionId) return;
    await declineRequest(connection.connectionId);
    analytics.track(EVENTS.buddy_request_declined);
    await load();
  };

  const handleRemoveBuddy = () => {
    setRemoveBuddyVisible(true);
  };

  const confirmRemoveBuddy = async () => {
    if (!connection.connectionId || removingBuddy) return;
    setRemovingBuddy(true);
    try {
      await removeBuddy(connection.connectionId);
      analytics.track(EVENTS.buddy_removed);
      await load();
      setRemoveBuddyVisible(false);
    } finally {
      setRemovingBuddy(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (screenState === 'loading') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Running Buddy</Text>
      </View>

      {!isConnected && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={14} color={colors.warning} />
          <Text style={styles.offlineText}>
            You're offline. Updates will resume when you reconnect.
          </Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.animatedContent}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View style={[styles.animatedContent, { opacity: fadeAnim }]}>
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.scrollContent,
            keyboardHeight > 0 && { paddingBottom: keyboardHeight + spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {screenState === 'no_buddy' && (
            <NoBuddyState
              code={buddyCode}
              inputCode={inputCode}
              inputError={inputError}
              submitting={submitting}
              onChangeInput={(v) => {
                setInputError('');
                setInputCode(v.toUpperCase().slice(0, 6));
              }}
              onSubmit={handleSubmitCode}
              onInputFocus={handleInputFocus}
            />
          )}

          {screenState === 'pending_sent' && (
            <PendingSentState
              buddyName={connection.buddy?.name ?? 'your friend'}
              buddyLevel={connection.buddy?.level}
              onCancel={handleCancelRequest}
            />
          )}

          {screenState === 'pending_received' && (
            <PendingReceivedState
              buddyName={connection.buddy?.name ?? 'Someone'}
              buddyLevel={connection.buddy?.level}
              onAccept={handleAccept}
              onDecline={handleDecline}
            />
          )}

          {screenState === 'active' && (
            <ActiveState
              myName={myName}
              buddyName={connection.buddy?.name ?? 'Runner'}
              buddyLevel={connection.buddy?.level ?? 1}
              pairedSince={connection.acceptedAt ?? connection.createdAt ?? null}
              onRemove={handleRemoveBuddy}
            />
          )}
        </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>

      <ConfirmDialog
        visible={removeBuddyVisible}
        icon="person-remove-outline"
        title="Remove buddy?"
        message={`Remove ${connection.buddy?.name ?? 'your buddy'} as your buddy? You can always pair up again later.`}
        confirmLabel={removingBuddy ? 'Removing…' : 'Remove'}
        cancelLabel="Keep buddy"
        destructive
        onCancel={() => !removingBuddy && setRemoveBuddyVisible(false)}
        onConfirm={confirmRemoveBuddy}
      />
    </SafeAreaView>
  );
}

// ─── State: No buddy ─────────────────────────────────────────────────────────

function NoBuddyState({
  code,
  inputCode,
  inputError,
  submitting,
  onChangeInput,
  onSubmit,
  onInputFocus,
}: {
  code: string | null;
  inputCode: string;
  inputError: string;
  submitting: boolean;
  onChangeInput: (v: string) => void;
  onSubmit: () => void;
  onInputFocus?: () => void;
}) {
  return (
    <View style={styles.stateContainer}>
      <View style={styles.heroBlock}>
        <View style={styles.heroIconWrap}>
          <View style={[styles.heroIconCircle, styles.heroIconCircleLeft]}>
            <Ionicons name="person" size={22} color={colors.primary} />
          </View>
          <View style={styles.heroIconConnector} />
          <View style={[styles.heroIconCircle, styles.heroIconCircleRight]}>
            <Ionicons name="person" size={22} color={colors.primary} />
          </View>
        </View>
        <Text style={styles.heroTitle}>Find your accountability partner</Text>
        <Text style={styles.heroSubtitle}>
          Pair with one friend you trust. See their progress, share yours, keep
          each other moving.
        </Text>
      </View>

      <BuddyCodeCard code={code} />

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>OR</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.inputCard}>
        <Text style={styles.inputLabel}>Enter a friend's code</Text>
        <TextInput
          style={styles.codeInput}
          placeholder="ABC123"
          placeholderTextColor={colors.textMuted}
          value={inputCode}
          onChangeText={onChangeInput}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          returnKeyType="done"
          onSubmitEditing={onSubmit}
          onFocus={onInputFocus}
        />
        {inputError ? <Text style={styles.errorText}>{inputError}</Text> : null}
        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            submitting && styles.buttonDisabled,
            pressed && styles.pressed,
          ]}
          onPress={onSubmit}
          disabled={submitting}
        >
          <Text style={styles.primaryButtonText}>
            {submitting ? 'Searching…' : 'Connect'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── State: Pending sent ─────────────────────────────────────────────────────

function PendingSentState({
  buddyName,
  buddyLevel,
  onCancel,
}: {
  buddyName: string;
  buddyLevel?: number;
  onCancel: () => void;
}) {
  return (
    <View style={styles.stateContainer}>
      <View style={styles.statusCard}>
        <PulsingDot />
        <Text style={styles.statusTitle}>Request sent to {buddyName}</Text>
        <Text style={styles.statusSubtitle}>
          We'll let you know when they accept.
        </Text>

        <View style={styles.pendingPersonRow}>
          <View style={styles.pendingAvatar}>
            <Text style={styles.pendingAvatarLetter}>
              {buddyName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.pendingPersonText}>
            <Text style={styles.pendingPersonName} numberOfLines={1}>
              {buddyName}
            </Text>
            {typeof buddyLevel === 'number' && (
              <Text style={styles.pendingPersonMeta}>Level {buddyLevel}</Text>
            )}
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.ghostButton,
            styles.stretchSelf,
            pressed && styles.pressed,
          ]}
          onPress={onCancel}
        >
          <Text style={styles.ghostButtonText}>Cancel request</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── State: Pending received ─────────────────────────────────────────────────

function PendingReceivedState({
  buddyName,
  buddyLevel,
  onAccept,
  onDecline,
}: {
  buddyName: string;
  buddyLevel?: number;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <View style={styles.stateContainer}>
      <View style={styles.statusCard}>
        <View style={styles.requestAvatar}>
          <Text style={styles.requestAvatarLetter}>
            {buddyName.charAt(0).toUpperCase()}
          </Text>
        </View>

        <Text style={styles.statusTitle}>{buddyName} wants to be your buddy</Text>
        {typeof buddyLevel === 'number' && (
          <View style={styles.requestLevelBadge}>
            <Text style={styles.requestLevelText}>LEVEL {buddyLevel}</Text>
          </View>
        )}

        <Text style={styles.statusSubtitle}>
          You'll see each other's sessions and progress.
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            styles.stretchSelf,
            pressed && styles.pressed,
          ]}
          onPress={onAccept}
        >
          <Text style={styles.primaryButtonText}>Accept</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.ghostButton,
            styles.stretchSelf,
            pressed && styles.pressed,
          ]}
          onPress={onDecline}
        >
          <Text style={styles.ghostButtonText}>Decline</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── State: Active buddy ─────────────────────────────────────────────────────

function ActiveState({
  myName,
  buddyName,
  buddyLevel,
  pairedSince,
  onRemove,
}: {
  myName: string;
  buddyName: string;
  buddyLevel: number;
  pairedSince: string | null;
  onRemove: () => void;
}) {
  return (
    <View style={styles.stateContainer}>
      <BuddyStateHeader
        myName={myName}
        buddyName={buddyName}
        buddyLevel={buddyLevel}
        pairedSince={pairedSince}
      />

      <View style={styles.activityPlaceholder}>
        <View style={styles.activityPlaceholderIcon}>
          <Ionicons name="pulse-outline" size={20} color={colors.textTertiary} />
        </View>
        <Text style={styles.activityPlaceholderTitle}>Buddy activity</Text>
        <Text style={styles.activityPlaceholderBody}>
          Sessions, streaks, and milestones will appear here soon.
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.removeRow, pressed && styles.pressed]}
        onPress={onRemove}
      >
        <Ionicons name="person-remove-outline" size={16} color={colors.textTertiary} />
        <Text style={styles.removeText}>Remove buddy</Text>
      </Pressable>
    </View>
  );
}

// ─── Pulsing dot for pending_sent ────────────────────────────────────────────

function PulsingDot() {
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = () =>
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.15,
            duration: 800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 0.85,
            duration: 800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.4,
            duration: 800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]);

    const loop = Animated.loop(pulse());
    loop.start();
    return () => loop.stop();
  }, [scale, opacity]);

  return (
    <View style={styles.pulseWrapper}>
      <Animated.View
        style={[
          styles.pulseRing,
          { transform: [{ scale }], opacity },
        ]}
      />
      <View style={styles.pulseDot} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    backgroundColor: colors.warningDim,
  },
  offlineText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.warning,
    letterSpacing: 0.2,
    flex: 1,
  },
  animatedContent: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  stateContainer: {
    gap: spacing.lg,
  },

  // ── Hero block (no_buddy) ─────────────────────────────────────────────────
  heroBlock: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  heroIconWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  heroIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryDim,
    borderWidth: 1.5,
    borderColor: 'rgba(16,185,129,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconCircleLeft: {
    transform: [{ translateX: 8 }],
  },
  heroIconCircleRight: {
    transform: [{ translateX: -8 }],
  },
  heroIconConnector: {
    width: 24,
    height: 2,
    backgroundColor: 'rgba(16,185,129,0.4)',
    zIndex: -1,
  },
  heroTitle: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.textPrimary,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    letterSpacing: 0.2,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },

  // ── Input card ────────────────────────────────────────────────────────────
  inputCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: spacing.cardRadius,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    gap: spacing.md,
  },
  inputLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  codeInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.textPrimary,
    letterSpacing: 6,
    textAlign: 'center',
  },
  errorText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.danger,
    textAlign: 'center',
  },

  // ── Divider ───────────────────────────────────────────────────────────────
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.surfaceBorder,
  },
  dividerText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.textTertiary,
    letterSpacing: 1.5,
  },

  // ── Buttons ───────────────────────────────────────────────────────────────
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: '#fff',
    letterSpacing: 0.3,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.75,
  },
  stretchSelf: {
    alignSelf: 'stretch',
  },
  ghostButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  ghostButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },

  // ── Status card (pending states) ──────────────────────────────────────────
  statusCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: spacing.cardRadius,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    gap: spacing.md,
  },
  statusTitle: {
    fontFamily: fonts.bold,
    fontSize: 19,
    color: colors.textPrimary,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  statusSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  pendingPersonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignSelf: 'stretch',
    marginTop: spacing.sm,
  },
  pendingAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryDim,
    borderWidth: 1.5,
    borderColor: 'rgba(16,185,129,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingAvatarLetter: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textPrimary,
  },
  pendingPersonText: {
    flex: 1,
  },
  pendingPersonName: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  pendingPersonMeta: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textTertiary,
    marginTop: 2,
  },

  // ── Pending received ──────────────────────────────────────────────────────
  requestAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryDim,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  requestAvatarLetter: {
    fontFamily: fonts.bold,
    fontSize: 28,
    color: colors.textPrimary,
  },
  requestLevelBadge: {
    backgroundColor: colors.primaryDim,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
  },
  requestLevelText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.primary,
    letterSpacing: 1.2,
  },

  // ── Pulsing dot ───────────────────────────────────────────────────────────
  pulseWrapper: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  pulseRing: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(16,185,129,0.25)',
  },
  pulseDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },

  // ── Active state ──────────────────────────────────────────────────────────
  activityPlaceholder: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: spacing.cardRadius,
    padding: spacing.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    gap: spacing.sm,
  },
  activityPlaceholderIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityPlaceholderTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
  activityPlaceholderBody: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
    letterSpacing: 0.2,
  },
  removeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  removeText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textTertiary,
    letterSpacing: 0.3,
  },
});
