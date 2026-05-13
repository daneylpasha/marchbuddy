import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import RunNavigator from './RunNavigator';
import ProgressNavigator from './ProgressNavigator';
import CommunityNavigator from './CommunityNavigator';
import CoachChatScreen from '../screens/chat/CoachChatScreen';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { useActiveSessionStore } from '../store/activeSessionStore';
import { featureFlags } from '../constants/featureFlags';
import { colors, fonts } from '../theme';

// Screens inside RunNavigator that should hide the tab bar entirely.
const IMMERSIVE_SCREENS = new Set([
  'ActiveSession',
  'PostSession',
  'CoachFeedback',
  'Celebration',
  'ShareSession',
]);

// ─── Tab param list ──────────────────────────────────────────────────────────

export type MainTabParamList = {
  Run: undefined;
  Progress: undefined;
  Community: undefined;
  Coach: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const CoachStack = createNativeStackNavigator();

// ─── Icon map ────────────────────────────────────────────────────────────────

const TAB_ICONS: Record<
  keyof MainTabParamList,
  { focused: keyof typeof Ionicons.glyphMap; unfocused: keyof typeof Ionicons.glyphMap }
> = {
  Run: { focused: 'walk', unfocused: 'walk-outline' },
  Progress: { focused: 'stats-chart', unfocused: 'stats-chart-outline' },
  Community: { focused: 'people', unfocused: 'people-outline' },
  Coach: { focused: 'chatbubble', unfocused: 'chatbubble-outline' },
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
  const userEmail = useAuthStore((state) => state.user?.email);
  const showCommunity = featureFlags.community(userEmail);
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === 'android' ? Math.max(insets.bottom, 12) : 0;
  // Cold-start resume edge case: when RunNavigator's initialRouteName lands
  // straight on ActiveSession, getFocusedRouteNameFromRoute() returns
  // undefined until the user navigates, which makes the tab bar flash on
  // top of the active session. Subscribe to the live "session is running"
  // flag and treat it as authoritative — if there's an active session,
  // we're on an immersive screen regardless of what the route hook says.
  const sessionActive = useActiveSessionStore((s) => s.isActive);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: [styles.tabBar, { paddingBottom: bottomPadding, height: 74 + bottomPadding }],
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
      <Tab.Screen
        name="Run"
        component={RunNavigator}
        options={({ route }) => {
          const focused = getFocusedRouteNameFromRoute(route);
          // If route detection hasn't resolved yet (cold-start resume into
          // ActiveSession), trust the activeSessionStore flag instead of
          // assuming we're on Today.
          const hidden = focused
            ? IMMERSIVE_SCREENS.has(focused)
            : sessionActive;
          return {
            tabBarLabel: 'Today',
            tabBarStyle: hidden
              ? { display: 'none' }
              : [styles.tabBar, { paddingBottom: bottomPadding, height: 74 + bottomPadding }],
          };
        }}
      />
      <Tab.Screen name="Progress" component={ProgressNavigator} />
      {showCommunity && (
        <Tab.Screen
          name="Community"
          component={CommunityNavigator}
          options={{ tabBarLabel: 'Community' }}
        />
      )}
      <Tab.Screen name="Coach" component={CoachStackNavigator} options={{ tabBarLabel: 'Coach' }} />
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
