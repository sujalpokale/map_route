import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail, Lock, Shield, Truck, User } from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/useAuthStore';
import { UserRole } from '@/types';

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();

  const [email, setEmail] = useState('sujal@routeintelligence.ai');
  const [password, setPassword] = useState('••••••••••••');
  const [role, setRole] = useState<UserRole>('DRIVER');

  const handleLogin = async () => {
    const success = await login(email, role);
    if (success) {
      router.replace('/(tabs)/home');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Sign In</Text>
          <Text style={styles.subtitle}>
            Enter your credentials to connect to the Route Intelligence Gateway.
          </Text>
        </View>

        {/* Role Selector */}
        <View style={styles.roleContainer}>
          <Text style={styles.roleLabel}>OPERATING ROLE</Text>
          <View style={styles.roleButtons}>
            {(['DRIVER', 'FLEET_MANAGER', 'USER'] as UserRole[]).map((r) => (
              <TouchableOpacity
                key={r}
                onPress={() => setRole(r)}
                style={[styles.roleBtn, role === r && styles.roleBtnActive]}
              >
                <Text style={[styles.roleText, role === r && styles.roleTextActive]}>
                  {r.replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Form Inputs */}
        <View style={styles.form}>
          <Input
            label="Email Address"
            value={email}
            onChangeText={setEmail}
            placeholder="driver@logistics.com"
            icon={<Mail size={18} color={THEME.colors.textMuted} />}
          />

          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            icon={<Lock size={18} color={THEME.colors.textMuted} />}
          />

          <TouchableOpacity style={styles.forgotBtn}>
            <Text style={styles.forgotText}>Forgot credentials?</Text>
          </TouchableOpacity>

          <Button
            title="Authenticate & Enter"
            onPress={handleLogin}
            variant="primary"
            size="lg"
            loading={isLoading}
            style={{ marginTop: 8 }}
          />

          <Button
            title="Skip & Open Live Map"
            onPress={() => router.replace('/(tabs)/home')}
            variant="secondary"
            size="md"
            style={{ marginTop: 10 }}
          />
        </View>

        {/* Quick Demo Access */}
        <View style={styles.demoCard}>
          <Shield size={16} color={THEME.colors.primaryLight} />
          <Text style={styles.demoText}>
            Pre-configured with Commercial Fleet Driver demo profile. Tap Authenticate to enter.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  scrollContent: {
    padding: THEME.spacing.screen,
    justifyContent: 'center',
    flexGrow: 1,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.typography.sizes.sm,
    marginTop: 6,
    lineHeight: 20,
  },
  roleContainer: {
    marginBottom: 20,
  },
  roleLabel: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  roleButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  roleBtn: {
    flex: 1,
    backgroundColor: THEME.colors.cardElevated,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    paddingVertical: 10,
    borderRadius: THEME.radius.md,
    alignItems: 'center',
  },
  roleBtnActive: {
    backgroundColor: THEME.colors.primaryGlow,
    borderColor: THEME.colors.primary,
  },
  roleText: {
    color: THEME.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  roleTextActive: {
    color: THEME.colors.primaryLight,
  },
  form: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.lg,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 16,
  },
  forgotText: {
    color: THEME.colors.primaryLight,
    fontSize: THEME.typography.sizes.xs,
    fontWeight: '600',
  },
  demoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    borderRadius: THEME.radius.md,
    padding: 12,
    marginTop: 20,
    borderWidth: 1,
    borderColor: THEME.colors.primaryGlow,
  },
  demoText: {
    color: THEME.colors.textSecondary,
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
  },
});
