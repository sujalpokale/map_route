import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { THEME } from '@/constants/theme';
import { useAuthStore } from '@/stores/useAuthStore';

function AuthGate() {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, isLoading, restoreSession } = useAuthStore();

  useEffect(() => { void restoreSession(); }, [restoreSession]);
  useEffect(() => {
    if (isLoading) return;
    const inAuth = segments[0] === '(auth)';
    if (!isAuthenticated && !inAuth) router.replace('/(auth)/login');
    else if (isAuthenticated && inAuth) router.replace('/(tabs)/home');
  }, [isAuthenticated, isLoading, router, segments]);

  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthGate />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: THEME.colors.background },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen name="(auth)/register" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="premium/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen
          name="navigation/[routeId]"
          options={{
            animation: 'slide_from_bottom',
            gestureEnabled: false,
          }}
        />
        <Stack.Screen name="navigation/active-trip" />
        <Stack.Screen name="route/details" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="vehicles/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="ocr/scan" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="ocr/location" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="settings/index" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
