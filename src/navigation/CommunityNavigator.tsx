import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CommunityScreen from '../screens/community/CommunityScreen';
import DiscoverScreen from '../screens/community/DiscoverScreen';
import UserProfileScreen from '../screens/community/UserProfileScreen';
import BuddiesScreen from '../screens/community/BuddiesScreen';
import MyTeamScreen from '../screens/community/MyTeamScreen';
import TeamSearchScreen from '../screens/community/TeamSearchScreen';
import ChallengesScreen from '../screens/community/ChallengesScreen';
import ActiveChallengeScreen from '../screens/community/ActiveChallengeScreen';

export type CommunityStackParamList = {
  CommunityHome: undefined;
  Discover: undefined;
  UserProfile: { userId: string };
  Buddies: undefined;
  MyTeam: undefined;
  TeamSearch: undefined;
  Challenges: undefined;
  ActiveChallenge: { challengeId: string };
};

const Stack = createNativeStackNavigator<CommunityStackParamList>();

export default function CommunityNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CommunityHome" component={CommunityScreen} />
      <Stack.Screen name="Discover" component={DiscoverScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="Buddies" component={BuddiesScreen} />
      <Stack.Screen name="MyTeam" component={MyTeamScreen} />
      <Stack.Screen name="TeamSearch" component={TeamSearchScreen} />
      <Stack.Screen name="Challenges" component={ChallengesScreen} />
      <Stack.Screen name="ActiveChallenge" component={ActiveChallengeScreen} />
    </Stack.Navigator>
  );
}
