import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../../theme';

interface QuickAction {
  id: string;
  label: string;
  message: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}

export interface QuickActionsContext {
  totalSessions: number;
  currentStreak: number;
  daysSinceLastSession: number | null;
  lastSessionFeedback?: string;
  currentLevel: number;
}

interface QuickActionsProps {
  onSelect: (message: string) => void;
  context?: QuickActionsContext;
}

// ─── Action sets by journey state ────────────────────────────────────────────

const DEFAULT_ACTIONS: QuickAction[] = [
  {
    id: 'progress',
    label: 'How am I doing?',
    message: 'How am I doing with my progress so far?',
    icon: 'stats-chart-outline',
  },
  {
    id: 'tired',
    label: 'Feeling tired',
    message: "I'm feeling pretty tired today",
    icon: 'bed-outline',
  },
  {
    id: 'motivation',
    label: 'Need motivation',
    message: "I'm struggling to stay motivated",
    icon: 'sad-outline',
  },
  {
    id: 'great',
    label: 'Feeling great!',
    message: "I'm feeling really good today!",
    icon: 'happy-outline',
  },
  {
    id: 'advice',
    label: 'Need advice',
    message: 'I need some advice about my training',
    icon: 'help-circle-outline',
  },
];

function getContextualActions(context?: QuickActionsContext): QuickAction[] {
  if (!context) return DEFAULT_ACTIONS;

  const { totalSessions, currentStreak, daysSinceLastSession, currentLevel } = context;

  // Brand new user — no sessions at all
  if (totalSessions === 0) {
    return [
      {
        id: 'nervous',
        label: "I'm nervous",
        message: "I'm about to start my first session and I'm a bit nervous",
        icon: 'heart-outline',
      },
      {
        id: 'what-expect',
        label: 'What to expect?',
        message: 'What should I expect from my first session?',
        icon: 'help-circle-outline',
      },
      {
        id: 'ready',
        label: "I'm ready!",
        message: "I'm excited to get started! Any tips for my first run?",
        icon: 'flash-outline',
      },
      {
        id: 'when-best',
        label: 'Best time to run?',
        message: "When's the best time of day for me to run?",
        icon: 'time-outline',
      },
    ];
  }

  // Comeback user — haven't been active in 3+ days
  if (daysSinceLastSession !== null && daysSinceLastSession >= 3) {
    return [
      {
        id: 'comeback',
        label: "I'm back!",
        message: `I've been away for ${daysSinceLastSession} days but I'm ready to get back on track`,
        icon: 'arrow-redo-outline',
      },
      {
        id: 'easier',
        label: 'Start easier?',
        message: "Should I ease back in after my break or pick up where I left off?",
        icon: 'fitness-outline',
      },
      {
        id: 'guilt',
        label: 'Feeling guilty',
        message: "I feel bad about missing so many days",
        icon: 'sad-outline',
      },
      {
        id: 'plan',
        label: 'Adjust my plan',
        message: 'Can you adjust my plan since I took a break?',
        icon: 'create-outline',
      },
    ];
  }

  // On a hot streak (7+ days)
  if (currentStreak >= 7) {
    return [
      {
        id: 'streak-check',
        label: `${currentStreak}-day streak!`,
        message: `I'm on a ${currentStreak}-day streak! How am I doing compared to most people?`,
        icon: 'flame-outline',
      },
      {
        id: 'push-harder',
        label: 'Push harder?',
        message: "I'm feeling strong. Should I push to a harder session today?",
        icon: 'trending-up-outline',
      },
      {
        id: 'rest-needed',
        label: 'Need a rest day?',
        message: "I've been going hard. Should I take a rest day?",
        icon: 'bed-outline',
      },
      {
        id: 'next-milestone',
        label: 'Next milestone?',
        message: "What's my next big milestone to aim for?",
        icon: 'trophy-outline',
      },
    ];
  }

  // Just leveled up or early in a new level
  if (totalSessions > 0 && totalSessions % 3 === 0) {
    return [
      {
        id: 'level-tips',
        label: `Level ${currentLevel} tips`,
        message: `I just reached Level ${currentLevel}. Any tips for this stage?`,
        icon: 'rocket-outline',
      },
      {
        id: 'progress',
        label: 'How am I doing?',
        message: 'How am I doing with my progress so far?',
        icon: 'stats-chart-outline',
      },
      {
        id: 'great',
        label: 'Feeling great!',
        message: "I'm feeling really good about my progress!",
        icon: 'happy-outline',
      },
      {
        id: 'advice',
        label: 'Need advice',
        message: 'I need some advice about my training at this level',
        icon: 'help-circle-outline',
      },
    ];
  }

  // Default — returning user in normal state
  return DEFAULT_ACTIONS;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ onSelect, context }) => {
  const actions = useMemo(() => getContextualActions(context), [context]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Quick topics</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {actions.map((action) => (
          <TouchableOpacity
            key={action.id}
            style={styles.action}
            onPress={() => onSelect(action.message)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={action.icon as React.ComponentProps<typeof Ionicons>['name']}
              size={18}
              color={colors.primary}
            />
            <Text style={styles.actionLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
  },
  title: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textTertiary,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  scrollContent: {
    gap: 8,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 7,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  actionLabel: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
  },
});
