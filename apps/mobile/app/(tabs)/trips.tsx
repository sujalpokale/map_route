import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Truck,
  Fuel,
  Clock,
  IndianRupee,
  Calendar,
  Sparkles,
  ChevronRight,
  TrendingDown,
  Leaf,
} from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { ROICard } from '@/components/analytics/ROICard';
import { useTripStore } from '@/stores/useTripStore';

export default function TripsScreen() {
  const { trips, totalFuelSavedLitres, totalCostSavedInr, totalDistanceKm } =
    useTripStore();
  const [filterPeriod, setFilterPeriod] = useState<'today' | 'week' | 'month'>('month');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        title="Journeys & Commercial Analytics"
        subtitle="Completed trips and telematics savings history"
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Executive ROI Savings Card */}
        <ROICard
          fuelSavedLitres={totalFuelSavedLitres}
          costSavedInr={totalCostSavedInr}
          timeSavedHours={18.5}
          totalDistanceKm={totalDistanceKm}
        />

        {/* Period Filter Tabs */}
        <View style={styles.filterRow}>
          {(['today', 'week', 'month'] as const).map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => setFilterPeriod(p)}
              style={[styles.filterBtn, filterPeriod === p && styles.filterBtnActive]}
            >
              <Text
                style={[
                  styles.filterText,
                  filterPeriod === p && styles.filterTextActive,
                ]}
              >
                {p.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Historical Journeys List */}
        <View style={styles.tripsSection}>
          <Text style={styles.sectionTitle}>Journey Records ({trips.length})</Text>

          {trips.map((trip) => {
            const timeSaved = Math.max(0, trip.planned_duration_min - trip.duration_min);

            return (
              <View key={trip.id} style={styles.tripCard}>
                <View style={styles.tripHeader}>
                  <View style={styles.timeTag}>
                    <Calendar size={12} color={THEME.colors.textMuted} />
                    <Text style={styles.timeText}>{trip.start_time}</Text>
                  </View>
                  <View style={styles.scorePill}>
                    <Text style={styles.scoreText}>IRS {trip.score}</Text>
                  </View>
                </View>

                {/* Corridor Route */}
                <Text style={styles.routeTitle}>
                  {trip.origin_name} → {trip.destination_name}
                </Text>

                {/* Telematics Metrics Row */}
                <View style={styles.metricsRow}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Distance</Text>
                    <Text style={styles.metricVal}>{trip.distance_km} km</Text>
                  </View>

                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Duration</Text>
                    <Text style={styles.metricVal}>{trip.duration_min} min</Text>
                  </View>

                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Fuel Used</Text>
                    <Text style={styles.metricVal}>{trip.fuel_litres} L</Text>
                  </View>

                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Trip Cost</Text>
                    <Text style={styles.metricVal}>₹{Math.round(trip.fuel_cost_inr)}</Text>
                  </View>
                </View>

                {/* Savings Highlights */}
                <View style={styles.savingsFooter}>
                  <View style={styles.savingsTag}>
                    <Clock size={12} color={THEME.colors.warning} />
                    <Text style={styles.savingsTagText}>{timeSaved} min saved</Text>
                  </View>
                  <View style={styles.savingsTag}>
                    <Leaf size={12} color={THEME.colors.success} />
                    <Text style={styles.savingsTagText}>{trip.co2_saved_kg} kg CO₂ offset</Text>
                  </View>
                </View>
              </View>
            );
          })}
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
    paddingBottom: 40,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterBtn: {
    flex: 1,
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    paddingVertical: 8,
    alignItems: 'center',
  },
  filterBtnActive: {
    backgroundColor: THEME.colors.primaryGlow,
    borderColor: THEME.colors.primary,
  },
  filterText: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  filterTextActive: {
    color: THEME.colors.primaryLight,
  },
  tripsSection: {
    gap: 12,
  },
  sectionTitle: {
    color: THEME.colors.text,
    fontSize: THEME.typography.sizes.md,
    fontWeight: '700',
    marginBottom: 4,
  },
  tripCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    padding: THEME.spacing.md,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  timeText: {
    color: THEME.colors.textMuted,
    fontSize: 11,
  },
  scorePill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: THEME.colors.success,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: THEME.radius.xs,
  },
  scoreText: {
    color: THEME.colors.success,
    fontSize: 10,
    fontWeight: '800',
  },
  routeTitle: {
    color: THEME.colors.text,
    fontSize: THEME.typography.sizes.sm,
    fontWeight: '700',
    marginBottom: 10,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.cardElevated,
    borderRadius: THEME.radius.md,
    padding: 10,
    marginBottom: 10,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    color: THEME.colors.textMuted,
    fontSize: 10,
  },
  metricVal: {
    color: THEME.colors.text,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  savingsFooter: {
    flexDirection: 'row',
    gap: 8,
  },
  savingsTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radius.xs,
  },
  savingsTagText: {
    color: THEME.colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
});
