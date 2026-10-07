import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lock, Mail, Phone, UserRound } from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/useAuthStore';

export default function RegisterScreen() {
  const router = useRouter();
  const { register, isLoading, error, clearError } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState('');

  const submit = async () => {
    setValidationError('');
    if (password !== confirmPassword) return setValidationError('Passwords do not match.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setValidationError('Enter a valid email address.');
    if (!/^\+[1-9]\d{7,14}$/.test(phone.replace(/[\s().-]/g, ''))) return setValidationError('Use international phone format, for example +919876543210.');
    if (password.length < 10 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      return setValidationError('Use at least 10 characters with uppercase, lowercase, and a number.');
    }
    const ok = await register({ name: name.trim(), email, phone, password });
    if (ok) router.replace('/(tabs)/home');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>ROUTE INTELLIGENCE</Text>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Your account starts with the Free plan.</Text>
        <View style={styles.form}>
          <Input label="Full name" value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" icon={<UserRound size={18} color={THEME.colors.textMuted} />} />
          <Input label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" icon={<Mail size={18} color={THEME.colors.textMuted} />} />
          <Input label="Phone number" value={phone} onChangeText={setPhone} placeholder="+919876543210" keyboardType="phone-pad" icon={<Phone size={18} color={THEME.colors.textMuted} />} />
          <Input label="Password" value={password} onChangeText={(value) => { clearError(); setPassword(value); }} placeholder="At least 10 characters" secureTextEntry icon={<Lock size={18} color={THEME.colors.textMuted} />} />
          <Input label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Re-enter password" secureTextEntry icon={<Lock size={18} color={THEME.colors.textMuted} />} />
          {validationError || error ? <Text accessibilityRole="alert" style={styles.error}>{validationError || error}</Text> : null}
          <Button title="Create Account" onPress={submit} loading={isLoading} disabled={!name || !email || !phone || !password || !confirmPassword} size="lg" />
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
              <Text style={styles.link}>Sign in</Text>
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
  subtitle: { color: THEME.colors.textSecondary, fontSize: 14, marginTop: 8, marginBottom: 20 },
  form: { backgroundColor: THEME.colors.card, borderColor: THEME.colors.cardBorder, borderWidth: 1, borderRadius: THEME.radius.lg, padding: THEME.spacing.lg },
  error: { color: THEME.colors.danger, fontSize: 13, marginBottom: 12 },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 22, flexWrap: 'wrap' },
  footerText: { color: THEME.colors.textSecondary, fontSize: 13 },
  link: { color: THEME.colors.primaryLight, fontSize: 13, fontWeight: '700' },
});
