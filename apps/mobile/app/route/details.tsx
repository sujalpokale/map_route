import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Sparkles,
  ShieldCheck,
  IndianRupee,
  Fuel,
  Clock,
  Navigation,
  Scale,
  CheckCircle2,
} from 'lucide-react-native';
import { THEME, getScoreColor } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { IRSScoreBreakdown } from '@/components/route/IRSScoreBreakdown';
import { Button } from '@/components/ui/Button';
import { useRouteStore } from '@/stores/useRouteStore';
import { useNavigationStore } from '@/stores/useNavigationStore';

export default function RouteDetailsScreen() {
  const router = useRouter();
  const { candidateRoutes, selectedRouteId, setSelectedRouteId, getSelectedRoute } =
    useRouteStore();
  const { startNavigation } = useNavigationStore();

  const selectedRoute = getSelectedRoute();

  const handleStartNav = () => {
    if (selectedRoute) {
      startNavigation(
        selectedRoute.steps,
        selectedRoute.distance_km,
        selectedRoute.duration_min
      );
      router.push({
        pathname: '/navigation/[routeId]',
        params: { routeId: selectedRoute.id },
      });
    }
  };

  if (!selectedRoute) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Route Intelligence Details" showBack />
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No route selected. Please plan a route first.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const scoreColor = getScoreColor(selectedRoute.overall_score);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Intelligent Route Score (IRS)" subtitle={selectedRoute.label} showBack />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Top IRS Score Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroLabel}>Overall Intelligent Route Score</Text>
              <Text style={[styles.heroScore, { color: scoreColor }]}>
                {selectedRoute.overall_score.toFixed(1)} / 100
              </Text>
            </View>

            <View style={[styles.scoreBadge, { borderColor: scoreColor }]}>
              <Sparkles size={16} color={scoreColor} />
              <Text style={[styles.badgeText, { color: scoreColor }]}>
                {selectedRoute.overall_score >= 88 ? 'OPTIMAL' : 'ACCEPTABLE'}
              </Text>
            </View>
          </View>

          <View style={styles.reasonBox}>
            <Text style={styles.reasonText}>
              💡 {selectedRoute.recommendation_reason}
            </Text>
          </View>
        </View>

        {/* 9-Factor Radar & Factor Weights */}
        <View style={styles.section}>
          <IRSScoreBreakdown
            subScores={selectedRoute.sub_scores}
            overallScore={selectedRoute.overall_score}
          />
        </View>

        {/* Commercial Cost Economics Breakdown */}
        <View style={styles.costCard}>
          <View style={styles.costHeader}>
            <IndianRupee size={18} color={THEME.colors.success} />
            <Text style={styles.costTitle}>Trip Economics & Operational Cost</Text>
          </View>

          <View style={styles.costList}>
            <View style={styles.costItem}>
              <Text style={styles.costName}>Fuel Consumption ({selectedRoute.fuel_litres} L)</Text>
              <Text style={styles.costVal}>₹{Math.round(selectedRoute.fuel_cost_inr)}</Text>
            </View>

            <View style={styles.costItem}>
              <Text style={styles.costName}>Highway Toll Charges</Text>
              <Text style={styles.costVal}>₹{Math.round(selectedRoute.toll_cost_inr)}</Text>
            </View>

            <View style={styles.costItem}>
              <Text style={styles.costName}>Driver Time Allocation</Text>
              <Text style={styles.costVal}>₹{Math.round(selectedRoute.driver_cost_inr)}</Text>
            </View>

            <View style={styles.costItem}>
              <Text style={styles.costName}>Vehicle Wear & Maintenance</Text>
              <Text style={styles.costVal}>₹{Math.round(selectedRoute.maintenance_cost_inr)}</Text>
            </View>

            <View style={styles.costDivider} />

            <View style={styles.costTotalItem}>
              <Text style={styles.costTotalLabel}>Estimated Total Journey Cost</Text>
              <Text style={styles.costTotalVal}>
                ₹{Math.round(selectedRoute.total_cost_inr)}
              </Text>
            </View>
          </View>
        </View>

        {/* Candidate Routes Comparison Matrix */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Candidate Route Alternatives</Text>
          {candidateRoutes.map((r) => {
            const isSelected = r.id === selectedRouteId;
            return (
              <TouchableOpacity
                key={r.id}
                onPress={() => setSelectedRouteId(r.id)}
                style={[styles.altCard, isSelected && styles.altCardActive]}
              >
                <View style={styles.altHeader}>
                  <Text style={styles.altLabel}>{r.label}</Text>
                  <Text style={[styles.altScore, { color: getScoreColor(r.overall_score) }]}>
                    IRS {r.overall_score.toFixed(1)}
                  </Text>
                </View>

                <View style={styles.altMetrics}>
                  <Text style={styles.altMetricText}>{r.duration_min} min</Text>
                  <Text style={styles.altDot}>•</Text>
                  <Text style={styles.altMetricText}>{r.distance_km} km</Text>
                  <Text style={styles.altDot}>•</Text>
                  <Text style={styles.altMetricText}>₹{Math.round(r.total_cost_inr)}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <Button
          title={`Start Navigation with Selected Route (${selectedRoute.duration_min} min)`}
          onPress={handleStartNav}
          variant="primary"
          size="lg"
          icon={<Navigation size={18} color="#090D16" />}
          style={{ marginTop: 10, marginBottom: 30 }}
        />
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
    paddingBottom: 40,
  },
  emptyBox: {
    padding: 30,
    alignItems: 'center',
  },
  emptyText: {
    color: THEME.colors.textMuted,
  },
  heroCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.lg,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    marginBottom: 16,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroLabel: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  heroScore: {
    fontSize: 32,
    fontWeight: '900',
    marginTop: 2,
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  reasonBox: {
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: THEME.colors.primary,
    padding: 10,
    borderRadius: THEME.radius.xs,
  },
  reasonText: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.typography.sizes.xs,
    lineHeight: 18,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: THEME.colors.text,
    fontSize: THEME.typography.sizes.md,
    fontWeight: '700',
    marginBottom: 10,
  },
  costCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    marginBottom: 16,
  },
  costHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  costTitle: {
    color: THEME.colors.text,
    fontSize: THEME.typography.sizes.sm,
    fontWeight: '700',
  },
  costList: {
    gap: 8,
  },
  costItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  costName: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.typography.sizes.xs,
  },
  costVal: {
    color: THEME.colors.text,
    fontSize: THEME.typography.sizes.xs,
    fontWeight: '600',
  },
  costDivider: {
    height: 1,
    backgroundColor: THEME.colors.cardBorder,
    marginVertical: 4,
  },
  costTotalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  costTotalLabel: {
    color: THEME.colors.text,
    fontSize: THEME.typography.sizes.sm,
    fontWeight: '700',
  },
  costTotalVal: {
    color: THEME.colors.success,
    fontSize: THEME.typography.sizes.md,
    fontWeight: '800',
  },
  altCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    padding: 12,
    marginBottom: 8,
  },
  altCardActive: {
    borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.cardHover,
  },
  altHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  altLabel: {
    color: THEME.colors.text,
    fontSize: THEME.typography.sizes.sm,
    fontWeight: '700',
  },
  altScore: {
    fontSize: 11,
    fontWeight: '800',
  },
  altMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  altMetricText: {
    color: THEME.colors.textMuted,
    fontSize: 11,
  },
  altDot: {
    color: THEME.colors.textMuted,
    marginHorizontal: 6,
  },
});
