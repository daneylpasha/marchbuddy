import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../theme';

interface WelcomeBackCardProps {
  missedDays: number;
  onDismiss: () => void;
}

function getMessage(missed: number): { emoji: string; title: string; body: string } {
  if (missed <= 1) {
    return {
      emoji: '\u{1F44B}',
      title: 'Welcome back!',
      body: 'One day off is no big deal. Let\'s pick up where you left off.',
    };
  }
  if (missed <= 3) {
    return {
      emoji: '\u{1F4AA}',
      title: 'Hey, you\'re back!',
      body: 'Everyone needs a breather. Today\'s workout is adjusted for an easy return.',
    };
  }
  if (missed <= 6) {
    return {
      emoji: '\u{1F305}',
      title: 'Good to see you!',
      body: 'I\'ve dialed down the intensity so you can ease back in comfortably.',
    };
  }
  return {
    emoji: '\u{1F331}',
    title: 'Fresh start!',
    body: 'No pressure at all. I\'ve set up a gentle workout to get you moving again.',
  };
}

export default function WelcomeBackCard({ missedDays, onDismiss }: WelcomeBackCardProps) {
  const { emoji, title, body } = getMessage(missedDays);

  return (
    <View style={styles.card}>
      <Pressable style={styles.dismissBtn} onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Dismiss">
        <Ionicons name="close" size={16} color={colors.textTertiary} />
      </Pressable>
      <View style={styles.content}>
        <Text style={styles.emoji}>{emoji}</Text>
        <View style={styles.textContent}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    borderLeftWidth: 3,
    borderLeftColor: colors.success,
    padding: 14,
    marginBottom: 12,
  },
  dismissBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingRight: 20,
  },
  emoji: {
    fontSize: 32,
    marginTop: 2,
  },
  textContent: {
    flex: 1,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: fonts.bold,
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  body: {
    color: '#aaa',
    fontSize: 14,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
    lineHeight: 20,
  },
});
