import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import NutritionHomeScreen from './NutritionScreen';
import FoodSnapScreen from './FoodSnapScreen';

export type NutritionStackParamList = {
  NutritionHome: undefined;
  FoodSnap: undefined;
};

const Stack = createNativeStackNavigator<NutritionStackParamList>();

export default function NutritionNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="NutritionHome" component={NutritionHomeScreen} />
      <Stack.Screen
        name="FoodSnap"
        component={FoodSnapScreen}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
