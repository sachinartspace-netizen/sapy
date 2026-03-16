import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { ActivityIndicator, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

import { api } from './src/api/client';
import { database } from './src/db/database';
import { licenseService } from './src/services/licenseService';
import { syncCoordinator } from './src/services/syncCoordinator';
import { RootNavigator } from './src/navigation/RootNavigator';

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState<string | null>(null);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        // Initialize database
        await database.initializeTables();

        // Check if user is already authenticated
        const token = await api.getToken();

        if (token) {
          setUserToken(token);
          
          // Initialize license service for authenticated user
          try {
            await licenseService.initialize();
          } catch (error) {
            console.error('Error initializing license:', error);
            // Continue anyway - license service has fallback to FREE tier
          }

          // Initialize sync coordinator for authenticated user
          try {
            await syncCoordinator.initialize();
          } catch (error) {
            console.error('Error initializing sync coordinator:', error);
            // Continue anyway - app can work without sync
          }
        }
      } catch (e) {
        console.error('Failed to restore token:', e);
        setUserToken(null);
      } finally {
        setIsLoading(false);
        await SplashScreen.hideAsync();
      }
    };

    bootstrap();

    // Cleanup on unmount
    return () => {
      syncCoordinator.destroy();
    };
  }, []);

  return (
    <NavigationContainer>
      <RootNavigator isLoading={isLoading} userToken={userToken} />
    </NavigationContainer>
  );
}
