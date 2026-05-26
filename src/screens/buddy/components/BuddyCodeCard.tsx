import React, { useState } from 'react';
import {
  Clipboard,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  ToastAndroid,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { analytics, EVENTS } from '../../../services/analytics';
import { colors, fonts, spacing } from '../../../theme';

interface Props {
  code: string | null;
}

const PLACEHOLDER = '------';

export default function BuddyCodeCard({ code }: Props) {
  const [copied, setCopied] = useState(false);
  const display = code ?? PLACEHOLDER;
  const characters = display.split('');

  const handleCopy = () => {
    if (!code) return;
    Clipboard.setString(code);
    analytics.track(EVENTS.buddy_code_copied);
    if (Platform.OS === 'android') {
      ToastAndroid.show('Copied!', ToastAndroid.SHORT);
    } else {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (!code) return;
    analytics.track(EVENTS.buddy_code_shared);
    await Share.share({
      message: `Join me on MarchBuddy! Use code ${code} to be my running buddy.`,
    });
  };

  return (
    <LinearGradient
      colors={['rgba(16,185,129,0.10)', 'rgba(16,185,129,0.02)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <Text style={styles.label}>Your Buddy Code</Text>

      <View style={styles.codeRow}>
        {characters.map((char, i) => (
          <View key={i} style={styles.codeBox}>
            <Text style={styles.codeChar}>{char}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.helper}>Share this with a friend to pair up</Text>

      <View style={styles.buttonRow}>
        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          onPress={handleCopy}
          disabled={!code}
        >
          <Ionicons
            name={copied ? 'checkmark-outline' : 'copy-outline'}
            size={16}
            color={colors.primary}
          />
          <Text style={styles.secondaryButtonText}>
            {copied ? 'Copied' : 'Copy'}
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          onPress={handleShare}
          disabled={!code}
        >
          <Ionicons name="share-outline" size={16} color="#fff" />
          <Text style={styles.primaryButtonText}>Share</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: spacing.cardRadius,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.25)',
    gap: spacing.lg,
  },
  label: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.primary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  codeBox: {
    flex: 1,
    aspectRatio: 0.85,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeChar: {
    fontFamily: fonts.bold,
    fontSize: 30,
    color: colors.textPrimary,
    letterSpacing: 0,
  },
  helper: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: '#fff',
    letterSpacing: 0.3,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.primaryDim,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    gap: 6,
  },
  secondaryButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.primary,
    letterSpacing: 0.3,
  },
  pressed: {
    opacity: 0.8,
  },
});
