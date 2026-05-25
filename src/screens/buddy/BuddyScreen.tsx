import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
  type BuddyConnectionState,
} from '../../services/buddyConnectionService';
import { colors, fonts, spacing } from '../../theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type ScreenState = 'loading' | 'no_buddy' | 'pending_sent' | 'pending_received' | 'active';

// ─── Component ────────────────────────────────────────────────────────────────

export default function BuddyScreen() {
  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [buddyCode, setBuddyCode] = useState<string | null>(null);
  const [connection, setConnection] = useState<BuddyConnectionState>({ status: 'none' });
  const [copied, setCopied] = useState(false);

  // Code input state
  const [inputCode, setInputCode] = useState('');
  const [inputError, setInputError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setScreenState('loading');
    const [code, conn] = await Promise.all([getMyBuddyCode(), getMyBuddyConnection()]);
    setBuddyCode(code);
    setConnection(conn);

    switch (conn.status) {
      case 'none':
        setScreenState('no_buddy');
        break;
      case 'pending_sent':
        setScreenState('pending_sent');
        break;
      case 'pending_received':
        setScreenState('pending_received');
        break;
      case 'active':
        setScreenState('active');
        break;
    }
  }, []);

  useEffect(() => {
    analytics.track(EVENTS.buddy_code_viewed);
    void load();
  }, [load]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handleCopy = async () => {
    if (!buddyCode) return;
    Clipboard.setString(buddyCode);
    analytics.track(EVENTS.buddy_code_copied);
    if (Platform.OS === 'android') {
      ToastAndroid.show('Copied!', ToastAndroid.SHORT);
    } else {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (!buddyCode) return;
    analytics.track(EVENTS.buddy_code_shared);
    await Share.share({
      message: `Join me on MarchBuddy! Use code ${buddyCode} to be my running buddy.`,
    });
  };

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
    Alert.alert(
      'Remove Buddy',
      `Are you sure you want to remove ${connection.buddy?.name ?? 'your buddy'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!connection.connectionId) return;
            await removeBuddy(connection.connectionId);
            analytics.track(EVENTS.buddy_removed);
            await load();
          },
        },
      ],
    );
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

      <View style={styles.content}>
        {/* ── State A: No buddy ─────────────────────────────────────────── */}
        {screenState === 'no_buddy' && (
          <>
            {/* Your Buddy Code */}
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Your Buddy Code</Text>
              <Text style={styles.buddyCode}>{buddyCode ?? '------'}</Text>
              <View style={styles.buttonRow}>
                <Pressable
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                  onPress={handleCopy}
                >
                  <Text style={styles.secondaryButtonText}>
                    {copied ? 'Copied!' : 'Copy Code'}
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                  onPress={handleShare}
                >
                  <Text style={styles.primaryButtonText}>Share Code</Text>
                </Pressable>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>— or —</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Enter a friend's code */}
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Have a friend's code?</Text>
              <TextInput
                style={styles.codeInput}
                placeholder="Enter 6-character code"
                placeholderTextColor={colors.textTertiary}
                value={inputCode}
                onChangeText={(v) => {
                  setInputError('');
                  setInputCode(v.toUpperCase().slice(0, 6));
                }}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={6}
                returnKeyType="done"
                onSubmitEditing={handleSubmitCode}
              />
              {inputError ? (
                <Text style={styles.errorText}>{inputError}</Text>
              ) : null}
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  styles.fullWidthButton,
                  submitting && styles.buttonDisabled,
                  pressed && styles.pressed,
                ]}
                onPress={handleSubmitCode}
                disabled={submitting}
              >
                <Text style={styles.primaryButtonText}>
                  {submitting ? 'Searching…' : 'Connect'}
                </Text>
              </Pressable>
            </View>
          </>
        )}

        {/* ── State B: Pending sent ─────────────────────────────────────── */}
        {screenState === 'pending_sent' && (
          <View style={styles.card}>
            <Text style={styles.stateTitle}>Request Sent</Text>
            <Text style={styles.stateBody}>
              Request sent to{' '}
              <Text style={styles.buddyNameInline}>
                {connection.buddy?.name ?? 'your friend'}
              </Text>
              . Waiting for them to accept.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]}
              onPress={handleCancelRequest}
            >
              <Text style={styles.ghostButtonText}>Cancel request</Text>
            </Pressable>
          </View>
        )}

        {/* ── State C: Pending received ─────────────────────────────────── */}
        {screenState === 'pending_received' && (
          <View style={styles.card}>
            <Text style={styles.stateTitle}>Buddy Request</Text>
            <Text style={styles.stateBody}>
              <Text style={styles.buddyNameInline}>
                {connection.buddy?.name ?? 'Someone'}
              </Text>{' '}
              wants to be your running buddy.
            </Text>
            <View style={styles.buttonRow}>
              <Pressable
                style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed]}
                onPress={handleDecline}
              >
                <Text style={styles.dangerButtonText}>Decline</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                onPress={handleAccept}
              >
                <Text style={styles.primaryButtonText}>Accept</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ── State D: Active buddy ─────────────────────────────────────── */}
        {screenState === 'active' && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Your Buddy</Text>
            <Text style={styles.activeBuddyName}>
              {connection.buddy?.name ?? 'Runner'}
            </Text>
            <Text style={styles.activeBuddyLevel}>
              Level {connection.buddy?.level ?? 1}
            </Text>
            <View style={styles.removeDivider} />
            <Pressable
              style={({ pressed }) => [styles.ghostButton, styles.dangerGhost, pressed && styles.pressed]}
              onPress={handleRemoveBuddy}
            >
              <Text style={styles.dangerGhostText}>Remove buddy</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
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
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: spacing.cardRadius,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    gap: spacing.md,
  },
  sectionLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  buddyCode: {
    fontFamily: fonts.bold,
    fontSize: 36,
    color: colors.primary,
    letterSpacing: 8,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  primaryButton: {
    flex: 1,
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
  secondaryButton: {
    flex: 1,
    backgroundColor: colors.primaryDim,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
  },
  secondaryButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.primary,
    letterSpacing: 0.3,
  },
  fullWidthButton: {
    flex: 0,
    width: '100%',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.8,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
    gap: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.surfaceBorder,
  },
  dividerText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textTertiary,
  },
  codeInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.textPrimary,
    letterSpacing: 4,
    textAlign: 'center',
  },
  errorText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.danger,
    textAlign: 'center',
  },
  stateTitle: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  stateBody: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    letterSpacing: 0.2,
  },
  buddyNameInline: {
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
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
  dangerButton: {
    flex: 1,
    backgroundColor: colors.dangerDim,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.3)',
  },
  dangerButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.danger,
    letterSpacing: 0.3,
  },
  activeBuddyName: {
    fontFamily: fonts.bold,
    fontSize: 28,
    color: colors.textPrimary,
    letterSpacing: 0.3,
    textAlign: 'center',
    paddingTop: spacing.sm,
  },
  activeBuddyLevel: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: colors.primary,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  removeDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.surfaceBorder,
    marginVertical: spacing.sm,
  },
  dangerGhost: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.3)',
    paddingHorizontal: spacing.lg,
  },
  dangerGhostText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.danger,
    letterSpacing: 0.3,
  },
});
