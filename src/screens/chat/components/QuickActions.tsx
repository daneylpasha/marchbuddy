import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../../theme';

interface QuickActionsProps {
  onSelect: (message: string) => void;
}

const QUICK_ACTIONS = [
  {
    id: '1',
    label: 'How am I doing?',
    message: 'How am I doing with my progress so far?',
    icon: 'stats-chart-outline',
  },
  {
    id: '2',
    label: 'Feeling tired',
    message: "I'm feeling pretty tired today",
    icon: 'bed-outline',
  },
  {
    id: '3',
    label: 'Need motivation',
    message: "I'm struggling to stay motivated",
    icon: 'sad-outline',
  },
  {
    id: '4',
    label: 'Feeling great!',
    message: "I'm feeling really good today!",
    icon: 'happy-outline',
  },
  {
    id: '5',
    label: 'Need advice',
    message: 'I need some advice about my training',
    icon: 'help-circle-outline',
  },
];

export const QuickActions: React.FC<QuickActionsProps> = ({ onSelect }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Quick topics</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {QUICK_ACTIONS.map((action) => (
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
