import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { THEME } from '@/constants/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
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
        <Stack.Screen
          name="navigation/[routeId]"
          options={{
            animation: 'slide_from_bottom',
            gestureEnabled: false,
          }}
        />
        <Stack.Screen name="navigation/active-trip" />
        <Stack.Screen name="route/details" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="deliveries/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="vehicles/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="ocr/scan" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="settings/index" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
