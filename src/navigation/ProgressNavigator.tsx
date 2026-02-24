import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProgressScreen from '../screens/progress/ProgressScreen';
import WorkoutHistoryScreen from '../screens/workout/WorkoutHistoryScreen';
import JourneyMapScreen from '../screens/journey/JourneyMapScreen';
import FeedbackScreen from '../screens/settings/FeedbackScreen';

export type ProgressStackParamList = {
  ProgressMain: undefined;
  WorkoutHistory: undefined;
  JourneyMap: undefined;
  Feedback: undefined;
};

const Stack = createNativeStackNavigator<ProgressStackParamList>();

export default function ProgressNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProgressMain" component={ProgressScreen} />
      <Stack.Screen name="WorkoutHistory" component={WorkoutHistoryScreen} />
      <Stack.Screen name="JourneyMap" component={JourneyMapScreen} />
      <Stack.Screen name="Feedback" component={FeedbackScreen} />
    </Stack.Navigator>
  );
}
