import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../theme';

interface PRCelebrationModalProps {
  visible: boolean;
  exerciseName: string;
  newWeight: number;
  newReps: number;
  previousWeight?: number;
  previousReps?: number;
  onDismiss: () => void;
}

export default function PRCelebrationModal({
  visible,
  exerciseName,
  newWeight,
  newReps,
  previousWeight,
  previousReps,
  onDismiss,
}: PRCelebrationModalProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0);
      glowAnim.setValue(0);

      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(glowAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
            Animated.timing(glowAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
          ]),
        ),
      ]).start();
    }
  }, [visible, scaleAnim, glowAnim]);

  const improvementText = previousWeight != null
    ? newWeight > previousWeight
      ? `+${(newWeight - previousWeight).toFixed(1)}kg`
      : newReps > (previousReps ?? 0)
        ? `+${newReps - (previousReps ?? 0)} reps`
        : 'New record!'
    : 'First tracked record!';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
          {/* Trophy icon */}
          <Animated.View style={[styles.trophyCircle, { opacity: Animated.add(0.7, Animated.multiply(glowAnim, 0.3)) }]}>
            <Ionicons name="trophy" size={44} color="#FFD700" />
          </Animated.View>

          <Text style={styles.title}>NEW PERSONAL RECORD!</Text>
          <Text style={styles.exerciseName}>{exerciseName}</Text>

          {/* New PR stats */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{newWeight}kg</Text>
              <Text style={styles.statLabel}>Weight</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{newReps}</Text>
              <Text style={styles.statLabel}>Reps</Text>
            </View>
          </View>

          {/* Improvement badge */}
          <View style={styles.improvementBadge}>
            <Ionicons name="arrow-up" size={14} color="#FFD700" />
            <Text style={styles.improvementText}>{improvementText}</Text>
          </View>

          {/* Previous best */}
          {previousWeight != null && (
            <Text style={styles.previousText}>
              Previous best: {previousWeight}kg x {previousReps ?? '?'}
            </Text>
          )}

          <Pressable style={styles.dismissBtn} onPress={onDismiss}>
            <Text style={styles.dismissBtnText}>Keep Crushing It</Text>
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
    borderColor: 'rgba(255,215,0,0.3)',
  },
  trophyCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,215,0,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: fonts.bold,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  exerciseName: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    fontFamily: fonts.bold,
    letterSpacing: 0.3,
    marginBottom: 20,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statBox: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    fontFamily: fonts.bold,
    letterSpacing: 0.3,
  },
  statLabel: {
    color: colors.textTertiary,
    fontSize: 12,
    fontFamily: fonts.medium,
    letterSpacing: 0.3,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.textMuted,
  },
  improvementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 12,
  },
  improvementText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    letterSpacing: 0.3,
  },
  previousText: {
    color: colors.textTertiary,
    fontSize: 13,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
    marginBottom: 20,
  },
  dismissBtn: {
    backgroundColor: '#FFD700',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    minHeight: 48,
    alignItems: 'center',
    width: '100%',
  },
  dismissBtnText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: fonts.bold,
    letterSpacing: 0.5,
  },
});
