import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TodayScreen from '../screens/session/TodayScreen';
import SessionDetailScreen from '../screens/session/SessionDetailScreen';
import ActiveSessionScreen from '../screens/session/ActiveSessionScreen';
import PostSessionScreen from '../screens/session/PostSessionScreen';
import CoachFeedbackScreen from '../screens/session/CoachFeedbackScreen';
import ShareSessionScreen from '../screens/session/ShareSessionScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import EditNameScreen from '../screens/settings/EditNameScreen';
import CelebrationScreen from '../screens/celebration/CelebrationScreen';
import { WelcomeBackScreen } from '../screens/comeback/WelcomeBackScreen';
import FeedbackScreen from '../screens/settings/FeedbackScreen';
import { useRunProgressStore } from '../store/runProgressStore';
import { useActiveSessionStore } from '../store/activeSessionStore';
import type { CompletedSession } from '../types/session';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RunStackParamList = {
  Today: undefined;
  SessionDetail: undefined;
  ActiveSession: undefined;
  PostSession: { session: CompletedSession };
  CoachFeedback: {
    coachFeedback: string;
    progressUpdate: {
      newLevel: number;
      leveledUp: boolean;
      totalSessions: number;
      currentStreak: number;
      milestoneReached: string | null;
    };
    session: CompletedSession;
    shareAfter: boolean;
  };
  Celebration: {
    milestoneId: string;
    coachFeedback: string;
    progressUpdate: {
      newLevel: number;
      leveledUp: boolean;
      totalSessions: number;
      currentStreak: number;
      milestoneReached: string | null;
    };
    session: CompletedSession;
    shareAfter: boolean;
  };
  ShareSession: { session: CompletedSession };
  Settings: undefined;
  EditName: undefined;
  Feedback: undefined;
};

const Stack = createNativeStackNavigator<RunStackParamList>();

type TodayScreenProps = NativeStackScreenProps<RunStackParamList, 'Today'>;

// Intercepts the Today screen slot and shows WelcomeBack when needed.
// React Navigation passes navigation + route as props to this component,
// so we forward them to TodayScreen to avoid "navigation is undefined".
const TodayScreenWithComebackGuard: React.FC<TodayScreenProps> = (props) => {
  const shouldShowComeback = useRunProgressStore((state) => state.shouldShowComeback);

  if (shouldShowComeback()) {
    return <WelcomeBackScreen />;
  }

  return <TodayScreen {...props} />;
};

export default function RunNavigator() {
  // Cold-start resume: if a session was in progress (paused or running) when
  // the app was last killed, the persisted store will rehydrate with isActive=true
  // and a non-null plan. Drop the user straight into ActiveSessionScreen so they
  // see "Resume" instead of starting a fresh session from Today. AppNavigator
  // already gates rendering on activeSessionStore hydration, so this read is safe.
  const persistedActive = useActiveSessionStore.getState();
  const initialRouteName: keyof RunStackParamList =
    persistedActive.isActive && persistedActive.plan ? 'ActiveSession' : 'Today';

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Today" component={TodayScreenWithComebackGuard} />
      <Stack.Screen name="SessionDetail" component={SessionDetailScreen} />
      <Stack.Screen
        name="ActiveSession"
        component={ActiveSessionScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen
        name="PostSession"
        component={PostSessionScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen
        name="CoachFeedback"
        component={CoachFeedbackScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen
        name="Celebration"
        component={CelebrationScreen}
        options={{ gestureEnabled: false, animation: 'fade' }}
      />
      <Stack.Screen name="ShareSession" component={ShareSessionScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="EditName" component={EditNameScreen} />
      <Stack.Screen name="Feedback" component={FeedbackScreen} />
    </Stack.Navigator>
  );
}
