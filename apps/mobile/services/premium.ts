import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/useAuthStore';

export type PremiumFeature =
  | 'ai_route_assistant'
  | 'advanced_traffic'
  | 'advanced_navigation'
  | 'multi_stop_optimization'
  | 'route_analytics';

export const PREMIUM_FEATURE_LABELS: Record<PremiumFeature, string> = {
  ai_route_assistant: 'AI Route Assistant',
  advanced_traffic: 'Advanced Traffic',
  advanced_navigation: 'Live Navigation',
  multi_stop_optimization: 'Multi-Stop Optimization',
  route_analytics: 'Route Analytics',
};

export function isActivePremium(subscription: ReturnType<typeof useAuthStore.getState>['subscription']) {
  if (!subscription || subscription.plan !== 'premium' || subscription.status !== 'active') {
    return false;
  }

  if (!subscription.expiry_date) {
    return true;
  }

  const expiry = new Date(subscription.expiry_date).getTime();
  return Number.isFinite(expiry) && expiry > Date.now();
}

export function usePremiumGate(feature: PremiumFeature) {
  const router = useRouter();
  const subscription = useAuthStore((state) => state.subscription);
  const isPremium = isActivePremium(subscription);

  const requirePremium = useCallback(() => {
    if (isPremium) return true;

    router.push({
      pathname: '/premium',
      params: { feature },
    });
    return false;
  }, [feature, isPremium, router]);

  return {
    isPremium,
    featureName: PREMIUM_FEATURE_LABELS[feature],
    requirePremium,
  };
}
