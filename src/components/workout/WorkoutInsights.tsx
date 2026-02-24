import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../theme';

interface WorkoutInsightsProps {
  /** Elapsed workout time in minutes (0 if not tracked) */
  elapsedMinutes: number;
  /** Today's RPE rating (1-10) or undefined if skipped */
  sessionRPE?: number;
  /** Average RPE over the last 7 days */
  avgRecentRPE?: number;
  /** Total exercises completed today */
  exercisesCompleted: number;
  /** Total exercises that were too easy */
  tooEasyCount: number;
  /** Total exercises that were too hard */
  tooHardCount: number;
  /** Current workout streak */
  streakDays: number;
}

interface Insight {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  text: string;
}

function generateInsights(props: WorkoutInsightsProps): Insight[] {
  const insights: Insight[] = [];

  // Duration insight
  if (props.elapsedMinutes > 0) {
    if (props.elapsedMinutes <= 30) {
      insights.push({
        icon: 'flash-outline',
        color: colors.success,
        text: `Quick and effective — ${props.elapsedMinutes} minutes. Efficiency is a superpower.`,
      });
    } else if (props.elapsedMinutes <= 60) {
      insights.push({
        icon: 'time-outline',
        color: colors.primary,
        text: `Solid ${props.elapsedMinutes}-minute session. Right in the sweet spot for gains.`,
      });
    } else {
      insights.push({
        icon: 'time-outline',
        color: colors.warning,
        text: `${props.elapsedMinutes} minutes today — that's a long one. Make sure you're resting enough between sets.`,
      });
    }
  }

  // RPE insight
  if (props.sessionRPE != null) {
    if (props.sessionRPE >= 9) {
      insights.push({
        icon: 'flame-outline',
        color: colors.danger,
        text: 'RPE 9+ — you went all out today. Consider a lighter session tomorrow to recover.',
      });
    } else if (props.sessionRPE >= 7) {
      insights.push({
        icon: 'barbell-outline',
        color: colors.warning,
        text: `RPE ${props.sessionRPE} — solid effort. You're pushing in the right zone for progress.`,
      });
    } else if (props.sessionRPE <= 4) {
      insights.push({
        icon: 'arrow-up-outline',
        color: colors.primary,
        text: `RPE ${props.sessionRPE} — felt pretty easy. Next session, try bumping up the weight or reps.`,
      });
    }

    // Fatigue trend
    if (props.avgRecentRPE != null && props.avgRecentRPE >= 8) {
      insights.push({
        icon: 'warning-outline',
        color: colors.danger,
        text: `Your average RPE is ${props.avgRecentRPE.toFixed(1)} this week — fatigue is building. A deload may be coming.`,
      });
    }
  }

  // Difficulty balance
  if (props.tooEasyCount > 0) {
    insights.push({
      icon: 'trending-up-outline',
      color: colors.success,
      text: `${props.tooEasyCount} exercise${props.tooEasyCount > 1 ? 's were' : ' was'} too easy — I'll increase intensity next session.`,
    });
  }
  if (props.tooHardCount > 0) {
    insights.push({
      icon: 'trending-down-outline',
      color: colors.warning,
      text: `${props.tooHardCount} exercise${props.tooHardCount > 1 ? 's were' : ' was'} too hard — I'll dial it back for next time.`,
    });
  }

  // Streak celebration
  if (props.streakDays > 0) {
    insights.push({
      icon: 'flame-outline',
      color: colors.streak,
      text: `+1 to your streak! ${props.streakDays} day${props.streakDays > 1 ? 's' : ''} and counting.`,
    });
  }

  // Fallback
  if (insights.length === 0) {
    insights.push({
      icon: 'sparkles-outline',
      color: colors.primary,
      text: 'Great work today. Your feedback helps me fine-tune every session.',
    });
  }

  return insights.slice(0, 4); // Max 4 insights
}

export default function WorkoutInsights(props: WorkoutInsightsProps) {
  const insights = generateInsights(props);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="bulb-outline" size={16} color={colors.primary} />
        <Text style={styles.title}>Insights</Text>
      </View>
      {insights.map((insight, i) => (
        <View key={i} style={styles.insightRow}>
          <View style={[styles.insightIcon, { backgroundColor: insight.color + '15' }]}>
            <Ionicons name={insight.icon} size={14} color={insight.color} />
          </View>
          <Text style={styles.insightText}>{insight.text}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
    letterSpacing: 0.3,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  insightIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  insightText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
    lineHeight: 19,
    flex: 1,
  },
});
