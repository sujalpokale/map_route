import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Sparkles, Navigation, Shield, Zap, ArrowRight } from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/useAuthStore';

export default function SplashScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  const handleGetStarted = () => {
    // Direct, frictionless entry directly to live interactive map
    router.replace('/(tabs)/home');
  };

  const handleSignIn = () => {
    router.push('/(auth)/login');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Background ambient lighting */}
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      {/* Top Brand Logo */}
      <View style={styles.brandContainer}>
        <View style={styles.iconCircle}>
          <Navigation size={32} color="#090D16" />
        </View>
        <Text style={styles.brandTitle}>ROUTE INTELLIGENCE</Text>
        <Text style={styles.brandTagline}>Plan Smarter. Drive Smarter. Optimize Every Journey.</Text>
      </View>

      {/* Feature Pillars */}
      <View style={styles.featuresList}>
        <View style={styles.featureItem}>
          <View style={styles.featureIcon}>
            <Sparkles size={18} color={THEME.colors.primaryLight} />
          </View>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>9-Factor IRS Scoring</Text>
            <Text style={styles.featureDesc}>
              Holistic route optimization balancing travel time, fuel physics, tolls, and safety.
            </Text>
          </View>
        </View>

        <View style={styles.featureItem}>
          <View style={styles.featureIcon}>
            <Zap size={18} color={THEME.colors.warning} />
          </View>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>Multi-Stop VRP Optimizer</Text>
            <Text style={styles.featureDesc}>
              2-opt heuristic sequencing with time windows, urgent priorities, and stop locking.
            </Text>
          </View>
        </View>

        <View style={styles.featureItem}>
          <View style={styles.featureIcon}>
            <Shield size={18} color={THEME.colors.success} />
          </View>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>Live Telematics & Copilot</Text>
            <Text style={styles.featureDesc}>
              Dynamic corridor rerouting, OCR address scanning, and hands-free voice AI.
            </Text>
          </View>
        </View>
      </View>

      {/* Action Footer */}
      <View style={styles.footer}>
        <Button
          title="Open Live Map & Navigation"
          onPress={handleGetStarted}
          variant="primary"
          size="lg"
          iconRight={<ArrowRight size={18} color="#090D16" />}
        />
        <Button
          title="Fleet Driver Sign In"
          onPress={handleSignIn}
          variant="secondary"
          size="md"
        />
        <Text style={styles.versionText}>AERO-ROUTE v1.0 • Commercial Grade • Free Map Access</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
    paddingHorizontal: THEME.spacing.screen,
    justifyContent: 'space-between',
    paddingVertical: THEME.spacing.lg,
  },
  glowTop: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: THEME.colors.primaryGlow,
    opacity: 0.6,
  },
  glowBottom: {
    position: 'absolute',
    bottom: -100,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: THEME.colors.secondaryGlow,
    opacity: 0.5,
  },
  brandContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: THEME.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 16,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  brandTagline: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.typography.sizes.sm,
    marginTop: 6,
    textAlign: 'center',
  },
  featuresList: {
    gap: 16,
    marginVertical: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: THEME.colors.card,
    padding: THEME.spacing.md,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    color: THEME.colors.text,
    fontSize: THEME.typography.sizes.sm,
    fontWeight: '700',
  },
  featureDesc: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.typography.sizes.xs,
    marginTop: 3,
    lineHeight: 16,
  },
  footer: {
    gap: 12,
  },
  versionText: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
  },
});
