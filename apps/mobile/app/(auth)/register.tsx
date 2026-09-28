import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail, Lock, User, ShieldCheck } from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/useAuthStore';
import { UserRole } from '@/types';

export default function RegisterScreen() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();

  const [name, setName] = useState('New Operator');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('DRIVER');

  const handleRegister = async () => {
    const success = await login(email || 'demo@routeintelligence.ai', role);
    if (success) {
      router.replace('/(tabs)/home');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Join Route Intelligence Fleet & Logistics Telematics Network.
          </Text>
        </View>

        {/* Role Selector */}
        <View style={styles.roleContainer}>
          <Text style={styles.roleLabel}>CHOOSE YOUR ROLE</Text>
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
            label="Full Name"
            value={name}
            onChangeText={setName}
            placeholder="Alex Mercer"
            icon={<User size={18} color={THEME.colors.textMuted} />}
          />

          <Input
            label="Email Address"
            value={email}
            onChangeText={setEmail}
            placeholder="operator@logistics.com"
            icon={<Mail size={18} color={THEME.colors.textMuted} />}
          />

          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Create password"
            secureTextEntry
            icon={<Lock size={18} color={THEME.colors.textMuted} />}
          />

          <Button
            title="Register & Get Started"
            onPress={handleRegister}
            variant="primary"
            size="lg"
            loading={isLoading}
            style={{ marginTop: 12 }}
          />

          <TouchableOpacity
            style={styles.loginRedirect}
            onPress={() => router.replace('/(auth)/login')}
          >
            <Text style={styles.loginRedirectText}>
              Already have an account? <Text style={{ color: THEME.colors.primaryLight }}>Sign In</Text>
            </Text>
          </TouchableOpacity>
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
  loginRedirect: {
    marginTop: 16,
    alignItems: 'center',
  },
  loginRedirectText: {
    color: THEME.colors.textMuted,
    fontSize: 12,
  },
});
