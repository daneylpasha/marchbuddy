import React from 'react';
import { StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import RunNavigator from './RunNavigator';
import ProgressNavigator from './ProgressNavigator';
import CoachChatScreen from '../screens/chat/CoachChatScreen';
import { useChatStore } from '../store/chatStore';
import { colors, fonts } from '../theme';

// ─── Tab param list ──────────────────────────────────────────────────────────

export type MainTabParamList = {
  Run: undefined;
  Progress: undefined;
  Coach: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const CoachStack = createNativeStackNavigator();

// ─── Icon map ────────────────────────────────────────────────────────────────

const TAB_ICONS: Record<keyof MainTabParamList, { focused: keyof typeof Ionicons.glyphMap; unfocused: keyof typeof Ionicons.glyphMap }> = {
  Run:      { focused: 'walk',           unfocused: 'walk-outline' },
  Progress: { focused: 'stats-chart',    unfocused: 'stats-chart-outline' },
  Coach:    { focused: 'chatbubble',     unfocused: 'chatbubble-outline' },
};

// ─── Coach Stack Navigator ────────────────────────────────────────────────────

function CoachStackNavigator() {
  return (
    <CoachStack.Navigator screenOptions={{ headerShown: false }}>
      <CoachStack.Screen name="CoachChatMain" component={CoachChatScreen} />
    </CoachStack.Navigator>
  );
}

// ─── Navigator ───────────────────────────────────────────────────────────────

export default function MainTabNavigator() {
  const hasUnread = useChatStore((state) => state.hasUnread);

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
          const icon = <Ionicons name={iconName} size={size} color={color} />;

          // Add badge for Coach tab if there are unread messages
          if (route.name === 'Coach' && hasUnread) {
            return (
              <View style={styles.iconWithBadge}>
                {icon}
                <View style={styles.badge} />
              </View>
            );
          }

          return icon;
        },
      })}
    >
      <Tab.Screen name="Run" component={RunNavigator} options={{ tabBarLabel: 'Today' }} />
      <Tab.Screen name="Progress" component={ProgressNavigator} />
      <Tab.Screen
        name="Coach"
        component={CoachStackNavigator}
        options={{ tabBarLabel: 'Coach' }}
      />
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
  iconWithBadge: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
});
