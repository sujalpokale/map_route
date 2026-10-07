import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, ChevronLeft, Crown, Lock, Sparkles } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME } from '@/constants/theme';
import { Button } from '@/components/ui/Button';
import { authApi } from '@/services/api/auth';
import { useAuthStore } from '@/stores/useAuthStore';
import { useLocalSearchParams } from 'expo-router';

const premiumFeatures = [
  'AI Route Assistant',
  'Advanced traffic and navigation',
  'Multi-stop route optimization',
  'Route analytics',
];

export default function PremiumScreen() {
  const router = useRouter();
  const { feature } = useLocalSearchParams<{ feature?: string }>();
  const { subscription, refreshSubscription } = useAuthStore();
  const [selectedCycle, setSelectedCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
  const [plans, setPlans] = useState<any>(null);

  useEffect(() => {
    authApi.getPlans().then((response) => setPlans(response.data));
    void refreshSubscription();
  }, [refreshSubscription]);

  const availablePlans = plans?.plans || [];
  const highlightedFeature = useMemo(() => {
    const map: Record<string, string> = {
      ai_route_assistant: 'AI Route Assistant',
      advanced_traffic: 'Advanced Traffic',
      advanced_navigation: 'Live Navigation',
      multi_stop_optimization: 'Multi-Stop Optimization',
      route_analytics: 'Route Analytics',
    };
    return feature ? map[feature] || feature.replaceAll('_', ' ') : null;
  }, [feature]);

  const isPremium = subscription?.plan === 'premium' && subscription.status === 'active';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Button title="Back" onPress={() => router.back()} variant="ghost" icon={<ChevronLeft size={18} color={THEME.colors.text} />} />
        <View style={styles.titleRow}>
          <Crown size={24} color="#FBBC04" />
          <Text style={styles.title}>Premium</Text>
        </View>
        <Text style={styles.current}>Current plan: {subscription?.plan?.toUpperCase() || 'FREE'}</Text>
        {highlightedFeature && !isPremium && (
          <View style={styles.reasonBanner}>
            <Lock size={15} color="#FBBC04" />
            <Text style={styles.reasonText}>
              {highlightedFeature} is available with Premium.
            </Text>
          </View>
        )}
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.features}>
          {premiumFeatures.map((feature) => <View key={feature} style={styles.feature}>
            <Check size={18} color={THEME.colors.success} /><Text style={styles.featureText}>{feature}</Text>
          </View>)}
        </View>
        {!plans ? <ActivityIndicator color={THEME.colors.primaryLight} /> : availablePlans.filter((plan: any) => plan.plan === 'premium').map((plan: any) => {
          const isSelected = plan.billing_cycle === selectedCycle;
          const label = plan.billing_cycle === 'yearly' ? 'Premium Yearly' : 'Premium Monthly';
          const period = plan.billing_cycle === 'yearly' ? 'year' : 'month';
          return (
            <TouchableOpacity
              key={`${plan.plan}-${plan.billing_cycle}`}
              style={[styles.plan, isSelected && styles.planSelected]}
              onPress={() => setSelectedCycle(plan.billing_cycle)}
              activeOpacity={0.82}
            >
              <View style={styles.planHeader}>
                <Text style={styles.planName}>{label}</Text>
                {isSelected && <Sparkles size={16} color="#FBBC04" />}
              </View>
              <Text style={styles.price}>
                {plan.price == null ? 'Price to be announced' : `₹${plan.price}`}
                <Text style={styles.per}> / {period}</Text>
              </Text>
              {plan.billing_cycle === 'yearly' && (
                <Text style={styles.savings}>Best value for regular drivers</Text>
              )}
            </TouchableOpacity>
          );
        })}

        {!isPremium ? (
          <Button
            title={checkoutMessage ? 'Checkout unavailable' : `Upgrade — Premium ${selectedCycle === 'yearly' ? 'Yearly' : 'Monthly'}`}
            onPress={() => {
              if (plans?.payment_provider !== 'not_configured') {
                setCheckoutMessage('Opening secure checkout...');
                return;
              }
              setCheckoutMessage('Payment provider is not configured yet. Premium locking is active, but checkout must be connected to Google Play/App Store or your chosen payment provider before customers can pay.');
            }}
            icon={<Crown size={17} color="#090D16" />}
            disabled={Boolean(checkoutMessage)}
          />
        ) : (
          <View style={styles.activePremium}>
            <Check size={18} color={THEME.colors.success} />
            <Text style={styles.activePremiumText}>
              Premium is active{subscription?.expiry_date ? ` until ${new Date(subscription.expiry_date).toLocaleDateString()}` : ''}.
            </Text>
          </View>
        )}

        {checkoutMessage && (
          <View style={styles.checkoutMessage}>
            <Text style={styles.checkoutMessageText}>{checkoutMessage}</Text>
          </View>
        )}

        <Text style={styles.note}>Premium features are enforced by the API as well as the mobile UI. A real subscription must be verified by the payment provider before premium access is activated.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  header: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: THEME.colors.cardBorder },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  title: { color: THEME.colors.text, fontSize: 24, fontWeight: '800' },
  current: { color: THEME.colors.textSecondary, fontSize: 13, marginTop: 5 },
  reasonBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, backgroundColor: 'rgba(251, 188, 4, 0.10)', borderWidth: 1, borderColor: 'rgba(251, 188, 4, 0.35)', borderRadius: THEME.radius.md, padding: 10 },
  reasonText: { color: '#FBBC04', fontSize: 11, fontWeight: '700', flex: 1 },
  content: { padding: 18, gap: 14 },
  features: { gap: 10, marginBottom: 8 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: { color: THEME.colors.text, fontSize: 14, flex: 1 },
  plan: { backgroundColor: THEME.colors.card, borderRadius: THEME.radius.md, borderColor: THEME.colors.cardBorder, borderWidth: 1, padding: 16 },
  planSelected: { borderColor: '#FBBC04', backgroundColor: 'rgba(251, 188, 4, 0.08)' },
  planHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planName: { color: THEME.colors.textSecondary, fontSize: 14, fontWeight: '700' },
  price: { color: THEME.colors.text, fontSize: 24, fontWeight: '800', marginTop: 6 },
  per: { color: THEME.colors.textSecondary, fontSize: 13, fontWeight: '500' },
  savings: { color: THEME.colors.success, fontSize: 11, fontWeight: '700', marginTop: 6 },
  activePremium: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: THEME.colors.successGlow, borderWidth: 1, borderColor: THEME.colors.success, borderRadius: THEME.radius.md, padding: 12 },
  activePremiumText: { color: THEME.colors.success, fontSize: 12, fontWeight: '700', flex: 1 },
  checkoutMessage: { backgroundColor: THEME.colors.cardElevated, borderRadius: THEME.radius.md, padding: 12, borderWidth: 1, borderColor: THEME.colors.cardBorder },
  checkoutMessageText: { color: THEME.colors.textSecondary, fontSize: 11, lineHeight: 17 },
  note: { color: THEME.colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 8 },
});
