import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, ChevronLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME } from '@/constants/theme';
import { Button } from '@/components/ui/Button';
import { authApi } from '@/services/api/auth';
import { useAuthStore } from '@/stores/useAuthStore';

const premiumFeatures = [
  'AI Route Assistant',
  'Advanced traffic and navigation',
  'Multi-stop route optimization',
  'Route analytics',
];

export default function PremiumScreen() {
  const router = useRouter();
  const { subscription, refreshSubscription } = useAuthStore();
  const [plans, setPlans] = useState<any>(null);

  useEffect(() => {
    authApi.getPlans().then((response) => setPlans(response.data));
    void refreshSubscription();
  }, [refreshSubscription]);

  const availablePlans = plans?.plans || [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Button title="Back" onPress={() => router.back()} variant="ghost" icon={<ChevronLeft size={18} color={THEME.colors.text} />} />
        <Text style={styles.title}>Premium</Text>
        <Text style={styles.current}>Current plan: {subscription?.plan?.toUpperCase() || 'FREE'}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.features}>
          {premiumFeatures.map((feature) => <View key={feature} style={styles.feature}>
            <Check size={18} color={THEME.colors.success} /><Text style={styles.featureText}>{feature}</Text>
          </View>)}
        </View>
        {!plans ? <ActivityIndicator color={THEME.colors.primaryLight} /> : availablePlans.map((plan: any) => {
          const label = plan.plan === 'free'
            ? 'Free'
            : plan.billing_cycle === 'yearly' ? 'Premium Yearly' : 'Premium Monthly';
          const period = plan.billing_cycle === 'yearly' ? 'year' : plan.billing_cycle === 'monthly' ? 'month' : '';
          return (
            <View key={`${plan.plan}-${plan.billing_cycle || 'free'}`} style={styles.plan}>
              <Text style={styles.planName}>{label}</Text>
              <Text style={styles.price}>
                {plan.price == null ? 'Price to be announced' : `₹${plan.price}`}
                {period ? <Text style={styles.per}> / {period}</Text> : null}
              </Text>
            </View>
          );
        })}
        <Text style={styles.note}>Secure checkout is not available yet. Premium access activates only after verified payment through a configured payment provider.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  header: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: THEME.colors.cardBorder },
  title: { color: THEME.colors.text, fontSize: 24, fontWeight: '800', marginTop: 8 },
  current: { color: THEME.colors.textSecondary, fontSize: 13, marginTop: 5 },
  content: { padding: 18, gap: 14 },
  features: { gap: 10, marginBottom: 8 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: { color: THEME.colors.text, fontSize: 14, flex: 1 },
  plan: { backgroundColor: THEME.colors.card, borderRadius: THEME.radius.md, borderColor: THEME.colors.cardBorder, borderWidth: 1, padding: 16 },
  planName: { color: THEME.colors.textSecondary, fontSize: 14, fontWeight: '700' },
  price: { color: THEME.colors.text, fontSize: 24, fontWeight: '800', marginTop: 6 },
  per: { color: THEME.colors.textSecondary, fontSize: 13, fontWeight: '500' },
  note: { color: THEME.colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 8 },
});
