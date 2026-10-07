import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lock, Mail } from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/useAuthStore';
import { authApi } from '@/services/api/auth';

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    const ok = await login(email, password);
    if (ok) router.replace('/(tabs)/home');
  };

  const handleForgotPassword = async () => {
    const result = await authApi.forgotPassword(email.trim().toLowerCase());
    Alert.alert('Password reset', result.data?.message || result.error || 'Password reset delivery is not configured yet.');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>ROUTE INTELLIGENCE</Text>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to your account to continue.</Text>
        <View style={styles.form}>
          <Input label="Email" value={email} onChangeText={(value) => { clearError(); setEmail(value); }} placeholder="you@example.com" keyboardType="email-address" icon={<Mail size={18} color={THEME.colors.textMuted} />} />
          <Input label="Password" value={password} onChangeText={(value) => { clearError(); setPassword(value); }} placeholder="Enter your password" secureTextEntry icon={<Lock size={18} color={THEME.colors.textMuted} />} />
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <TouchableOpacity style={styles.forgot} onPress={handleForgotPassword}>
            <Text style={styles.link}>Forgot password?</Text>
          </TouchableOpacity>
          <Button title="Sign In" onPress={handleLogin} loading={isLoading} disabled={!email || !password} size="lg" />
          <View style={styles.footer}>
            <Text style={styles.footerText}>New to Route Intelligence?</Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.link}>Create account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: THEME.spacing.screen },
  eyebrow: { color: THEME.colors.primaryLight, fontWeight: '800', fontSize: 12, marginBottom: 12 },
  title: { color: THEME.colors.text, fontSize: 28, fontWeight: '800' },
  subtitle: { color: THEME.colors.textSecondary, fontSize: 14, marginTop: 8, marginBottom: 24 },
  form: { backgroundColor: THEME.colors.card, borderColor: THEME.colors.cardBorder, borderWidth: 1, borderRadius: THEME.radius.lg, padding: THEME.spacing.lg },
  error: { color: THEME.colors.danger, fontSize: 13, marginBottom: 8 },
  forgot: { alignSelf: 'flex-end', paddingVertical: 8, marginBottom: 8 },
  link: { color: THEME.colors.primaryLight, fontSize: 13, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 22, flexWrap: 'wrap' },
  footerText: { color: THEME.colors.textSecondary, fontSize: 13 },
});
