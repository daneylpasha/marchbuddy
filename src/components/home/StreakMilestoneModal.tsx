import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../theme';

interface StreakMilestoneModalProps {
  visible: boolean;
  streakDays: number;
  onDismiss: () => void;
}

const MILESTONES: Record<number, { emoji: string; title: string; message: string }> = {
  7: { emoji: '\uD83C\uDF1F', title: 'First Week!', message: '7 days consistent. You\'re building a real habit!' },
  14: { emoji: '\uD83D\uDCAA', title: 'Two Weeks Strong!', message: '14 days in a row. Most people quit by now — not you.' },
  21: { emoji: '\uD83C\uDFC6', title: 'Three Weeks!', message: '21 days — the science says this is when habits stick.' },
  30: { emoji: '\uD83D\uDD25', title: 'One Month!', message: '30 days of consistency. You\'re unstoppable.' },
  50: { emoji: '\uD83D\uDE80', title: '50 Days!', message: 'Half a hundred. You\'ve transformed your routine.' },
  75: { emoji: '\uD83D\uDC8E', title: '75 Days!', message: 'This is discipline. This is who you are now.' },
  100: { emoji: '\uD83C\uDF89', title: '100 Days!', message: 'Triple digits. You\'re in the top 1% of consistency.' },
};

function getMilestone(days: number) {
  return MILESTONES[days] ?? null;
}

export function isMilestoneDay(days: number): boolean {
  return days in MILESTONES;
}

export default function StreakMilestoneModal({ visible, streakDays, onDismiss }: StreakMilestoneModalProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const milestone = getMilestone(streakDays);

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0);
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 50,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, scaleAnim]);

  if (!milestone) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
          <Text style={styles.emoji}>{milestone.emoji}</Text>
          <Text style={styles.streakNumber}>{streakDays}</Text>
          <Text style={styles.streakLabel}>DAY STREAK</Text>
          <Text style={styles.title}>{milestone.title}</Text>
          <Text style={styles.message}>{milestone.message}</Text>

          <Pressable style={styles.btn} onPress={onDismiss}>
            <Text style={styles.btnText}>Keep Going!</Text>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000000CC',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,152,0,0.3)',
  },
  emoji: {
    fontSize: 52,
    marginBottom: 8,
  },
  streakNumber: {
    color: colors.streak,
    fontSize: 48,
    fontWeight: '700',
    fontFamily: fonts.bold,
    letterSpacing: 1,
  },
  streakLabel: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    letterSpacing: 2,
    marginBottom: 12,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    fontFamily: fonts.bold,
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  message: {
    color: colors.textSecondary,
    fontSize: 15,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  btn: {
    backgroundColor: colors.streak,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    minHeight: 48,
    alignItems: 'center',
    width: '100%',
  },
  btnText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: fonts.bold,
    letterSpacing: 0.5,
  },
});
