import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../theme';

interface WorkoutSummaryProps {
  completed: number;
  skipped: number;
  tooEasy: number;
  tooHard: number;
  total: number;
}

export default function WorkoutSummary({ completed, skipped, tooEasy, tooHard, total }: WorkoutSummaryProps) {
  const celebrationScale = useRef(new Animated.Value(0)).current;
  const allDone = completed + tooEasy === total;

  useEffect(() => {
    Animated.spring(celebrationScale, {
      toValue: 1,
      friction: 4,
      tension: 60,
      useNativeDriver: true,
    }).start();
  }, [celebrationScale]);

  const getMessage = () => {
    if (allDone) return 'Crushed it! Every single exercise done.';
    if (completed + tooEasy >= total * 0.8) return 'Great session — almost everything done!';
    if (skipped >= total * 0.5) return 'Showing up is what counts. We\'ll get after it next time.';
    return 'Solid work today. Every rep counts.';
  };

  return (
    <View style={styles.container}>
      {/* Celebration */}
      <Animated.View style={[styles.celebRow, { transform: [{ scale: celebrationScale }] }]}>
        <Text style={styles.celebEmoji}>{allDone ? '\uD83C\uDF89' : '\uD83D\uDCAA'}</Text>
        <Text style={styles.celebTitle}>Workout Complete!</Text>
      </Animated.View>

      <Text style={styles.message}>{getMessage()}</Text>

      {/* Stats grid */}
      <View style={styles.grid}>
        <StatBox
          icon="checkmark-circle"
          color={colors.success}
          value={completed}
          label="Completed"
        />
        <StatBox
          icon="play-skip-forward"
          color={colors.textSecondary}
          value={skipped}
          label="Skipped"
        />
        <StatBox
          icon="flash"
          color={colors.warning}
          value={tooEasy}
          label="Too Easy"
        />
        <StatBox
          icon="barbell"
          color={colors.danger}
          value={tooHard}
          label="Too Hard"
        />
      </View>

      <View style={styles.noteBox}>
        <Ionicons name="bulb-outline" size={16} color={colors.primary} />
        <Text style={styles.noteText}>
          {tooEasy > 0
            ? `You found ${tooEasy} exercise${tooEasy > 1 ? 's' : ''} too easy — I'll bump up the intensity next session.`
            : tooHard > 0
            ? `${tooHard} exercise${tooHard > 1 ? 's were' : ' was'} too hard — I'll adjust the load for next time.`
            : 'Your feedback helps me fine-tune your plan every session.'}
        </Text>
      </View>
    </View>
  );
}

function StatBox({ icon, color, value, label }: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  value: number;
  label: string;
}) {
  return (
    <View style={styles.statBox}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    padding: 20,
  },
  celebRow: {
    alignItems: 'center',
    marginBottom: 8,
  },
  celebEmoji: {
    fontSize: 44,
    marginBottom: 6,
  },
  celebTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    fontFamily: fonts.bold,
    letterSpacing: 0.3,
  },
  message: {
    color: '#aaa',
    fontSize: 14,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
    textAlign: 'center',
    marginBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingVertical: 14,
    gap: 4,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    fontFamily: fonts.bold,
    letterSpacing: 0.3,
  },
  statLabel: {
    color: colors.textTertiary,
    fontSize: 10,
    fontWeight: '500',
    fontFamily: fonts.medium,
    letterSpacing: 0.3,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.primaryDim,
    borderRadius: 10,
    padding: 12,
  },
  noteText: {
    color: '#aaa',
    fontSize: 13,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
    flex: 1,
    lineHeight: 19,
  },
});
