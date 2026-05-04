import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CommunityScreen from '../screens/community/CommunityScreen';
import DiscoverScreen from '../screens/community/DiscoverScreen';
import UserProfileScreen from '../screens/community/UserProfileScreen';
import BuddiesScreen from '../screens/community/BuddiesScreen';

export type CommunityStackParamList = {
  CommunityHome: undefined;
  Discover: undefined;
  UserProfile: { userId: string };
  Buddies: undefined;
};

const Stack = createNativeStackNavigator<CommunityStackParamList>();

export default function CommunityNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CommunityHome" component={CommunityScreen} />
      <Stack.Screen name="Discover" component={DiscoverScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="Buddies" component={BuddiesScreen} />
    </Stack.Navigator>
  );
}
