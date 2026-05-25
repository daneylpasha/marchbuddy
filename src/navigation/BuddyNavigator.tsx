import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BuddyScreen from '../screens/buddy/BuddyScreen';

export type BuddyStackParamList = {
  BuddyHome: undefined;
};

const Stack = createNativeStackNavigator<BuddyStackParamList>();

export default function BuddyNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BuddyHome" component={BuddyScreen} />
    </Stack.Navigator>
  );
}
