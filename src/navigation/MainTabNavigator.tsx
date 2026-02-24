import React from 'react';
import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import RunNavigator from './RunNavigator';
import ProgressNavigator from './ProgressNavigator';
import { colors, fonts } from '../theme';

// ─── Tab param list ──────────────────────────────────────────────────────────

export type MainTabParamList = {
  Run: undefined;
  Progress: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

// ─── Icon map ────────────────────────────────────────────────────────────────

const TAB_ICONS: Record<keyof MainTabParamList, { focused: keyof typeof Ionicons.glyphMap; unfocused: keyof typeof Ionicons.glyphMap }> = {
  Run:      { focused: 'walk',        unfocused: 'walk-outline' },
  Progress: { focused: 'stats-chart', unfocused: 'stats-chart-outline' },
};

// ─── Navigator ───────────────────────────────────────────────────────────────

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#666',
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name as keyof MainTabParamList];
          const iconName = focused ? icons.focused : icons.unfocused;
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Run" component={RunNavigator} options={{ tabBarLabel: 'Today' }} />
      <Tab.Screen name="Progress" component={ProgressNavigator} />
    </Tab.Navigator>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.background,
    borderTopColor: colors.surfaceBorder,
    borderTopWidth: 1,
    height: 88,
    paddingTop: 8,
  },
  tabLabel: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    letterSpacing: 0.3,
  },
});
