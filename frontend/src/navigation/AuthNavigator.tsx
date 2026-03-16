import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../types';

import OnboardingScreen from '../screens/OnboardingScreen';
import GoogleLoginScreen from '../screens/GoogleLoginScreen';
import PhoneOTPScreen from '../screens/PhoneOTPScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: true,
        cardStyle: { backgroundColor: '#fff' },
      }}
    >
      <Stack.Screen 
        name="Onboarding" 
        component={OnboardingScreen}
        options={{
          animationTypeForReplace: 'pop',
        }}
      />
      <Stack.Screen 
        name="GoogleLogin" 
        component={GoogleLoginScreen}
        options={{
          animationTypeForReplace: 'fade',
        }}
      />
      <Stack.Screen 
        name="PhoneOTP" 
        component={PhoneOTPScreen}
        options={{
          animationTypeForReplace: 'fade',
        }}
      />
    </Stack.Navigator>
  );
}
