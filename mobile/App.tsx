import React, { useEffect, useState, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { useColorScheme, View, StyleSheet } from 'react-native';

import RootNavigator from './src/navigation/RootNavigator';
import { useAuthStore } from './src/store/auth.store';
import { linking } from './src/navigation/linking';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);
  const { checkAuth, isLoading } = useAuthStore();
  const colorScheme = useColorScheme();

  useEffect(() => {
    async function prepare() {
      try {
        // Check authentication status
        await checkAuth();
      } catch (e) {
        console.warn('Error during initialization:', e);
      } finally {
        setAppIsReady(true);
      }
    }

    prepare();
  }, [checkAuth]);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady && !isLoading) {
      // Hide splash screen after app is ready
      await SplashScreen.hideAsync();
    }
  }, [appIsReady, isLoading]);

  if (!appIsReady || isLoading) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <NavigationContainer
          linking={linking}
          onReady={onLayoutRootView}
          theme={colorScheme === 'dark' ? DarkTheme : LightTheme}
        >
          <RootNavigator />
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Theme configurations
const DarkTheme = {
  dark: true,
  colors: {
    primary: '#10b981',
    background: '#0f172a',
    card: '#1e293b',
    text: '#f8fafc',
    border: '#334155',
    notification: '#ef4444',
  },
};

const LightTheme = {
  dark: false,
  colors: {
    primary: '#10b981',
    background: '#f8fafc',
    card: '#ffffff',
    text: '#0f172a',
    border: '#e2e8f0',
    notification: '#ef4444',
  },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
