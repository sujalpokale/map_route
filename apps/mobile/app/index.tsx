import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { THEME } from '@/constants/theme';
import { useAuthStore } from '@/stores/useAuthStore';

export default function IndexScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();
  useEffect(() => {
    if (!isLoading) router.replace(isAuthenticated ? '/(tabs)/home' : '/(auth)/login');
  }, [isAuthenticated, isLoading, router]);
  return <View style={styles.container}><ActivityIndicator color={THEME.colors.primaryLight} /></View>;
}

const styles = StyleSheet.create({ container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.colors.background } });
