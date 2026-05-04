import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CommunityScreen from '../screens/community/CommunityScreen';

export type CommunityStackParamList = {
  CommunityHome: undefined;
};

const Stack = createNativeStackNavigator<CommunityStackParamList>();

export default function CommunityNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CommunityHome" component={CommunityScreen} />
    </Stack.Navigator>
  );
}
