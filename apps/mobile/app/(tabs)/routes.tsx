import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus,
  Sparkles,
  Zap,
  Lock,
  ArrowUpDown,
  Navigation,
  CheckCircle2,
  Clock,
  ShieldAlert,
} from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StopList } from '@/components/route/StopList';
import { OptimizationSelector } from '@/components/route/OptimizationSelector';
import { IRSScoreBreakdown } from '@/components/route/IRSScoreBreakdown';
import { useRouteStore } from '@/stores/useRouteStore';
import { useNavigationStore } from '@/stores/useNavigationStore';
import { StopItem } from '@/types';

export default function RoutesScreen() {
  const router = useRouter();
  const {
    stops,
    addStop,
    removeStop,
    toggleStopLock,
    optimizationMode,
    setOptimizationMode,
    optimizeMultiStops,
    calculateRoutes,
    getSelectedRoute,
    isLoading,
  } = useRouteStore();
  const { startNavigation } = useNavigationStore();

  const [newStopAddress, setNewStopAddress] = useState('');
  const [newStopPriority, setNewStopPriority] = useState<number>(1);
  const [showAddForm, setShowAddForm] = useState(false);

  const selectedRoute = getSelectedRoute();

  const handleAddNewStop = () => {
    if (!newStopAddress.trim()) return;

    const stop: StopItem = {
      id: `stop_${Date.now()}`,
      address: newStopAddress.trim(),
      name: newStopAddress.split(',')[0],
      lat: 18.5204 + (Math.random() - 0.5) * 0.08,
      lng: 73.8567 + (Math.random() - 0.5) * 0.08,
      priority: newStopPriority,
      time_window_start: '11:00',
      time_window_end: '13:00',
      package_weight_kg: 10,
      is_locked: false,
    } as any;

    addStop(stop);
    setNewStopAddress('');
    setShowAddForm(false);
  };

  const handleOptimizeVRP = async () => {
    await optimizeMultiStops();
    await calculateRoutes();
  };

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        title="Multi-Stop Route Optimizer"
        subtitle="2-Opt VRP Heuristic Engine with Constraints"
        rightAction={
          <TouchableOpacity
            onPress={() => setShowAddForm(!showAddForm)}
            style={styles.addIconBtn}
          >
            <Plus size={18} color={THEME.colors.primaryLight} />
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Quick VRP Optimizer Banner */}
        <View style={styles.optimizerBanner}>
          <View style={styles.bannerLeft}>
            <Sparkles size={20} color={THEME.colors.primaryLight} />
            <View>
              <Text style={styles.bannerTitle}>2-Opt VRP Multi-Stop Sequencer</Text>
              <Text style={styles.bannerSub}>
                Re-orders {stops.length} stops to minimize fuel & satisfy delivery windows.
              </Text>
            </View>
          </View>

          <Button
            title="Optimize Stops"
            onPress={handleOptimizeVRP}
            variant="primary"
            size="sm"
            loading={isLoading}
            icon={<Zap size={14} color="#090D16" />}
          />
        </View>

        {/* Optimization Objective Selector */}
        <OptimizationSelector
          selectedMode={optimizationMode}
          onSelectMode={setOptimizationMode}
        />

        {/* Add Stop Form Dropdown */}
        {showAddForm && (
          <View style={styles.addForm}>
            <Text style={styles.formTitle}>Add Waypoint / Delivery Stop</Text>
            <Input
              placeholder="e.g. Aundh Plaza, DP Road, Pune"
              value={newStopAddress}
              onChangeText={setNewStopAddress}
              label="Destination Address"
            />

            <View style={styles.priorityRow}>
              <Text style={styles.priorityLabel}>Priority Constraint:</Text>
              <View style={styles.priorityBtns}>
                {[
                  { label: 'Normal', val: 1 },
                  { label: 'High', val: 2 },
                  { label: 'Urgent', val: 3 },
                ].map((p) => (
                  <TouchableOpacity
                    key={p.val}
                    onPress={() => setNewStopPriority(p.val)}
                    style={[
                      styles.pBtn,
                      newStopPriority === p.val && styles.pBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.pBtnText,
                        newStopPriority === p.val && styles.pBtnTextActive,
                      ]}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Button
              title="Add Stop to Itinerary"
              onPress={handleAddNewStop}
              variant="secondary"
              size="md"
              style={{ marginTop: 8 }}
            />
          </View>
        )}

        {/* Sequenced Waypoints List */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Stop Sequence ({stops.length})</Text>
            <Text style={styles.sectionSub}>Tap lock icon to freeze stop position</Text>
          </View>

          <StopList
            stops={stops}
            onToggleLock={toggleStopLock}
            onRemoveStop={removeStop}
          />
        </View>

        {/* 9-Factor IRS Score Breakdown */}
        {selectedRoute && (
          <View style={styles.section}>
            <IRSScoreBreakdown
              subScores={selectedRoute.sub_scores}
              overallScore={selectedRoute.overall_score}
            />
          </View>
        )}

        {/* Launch Navigation Action */}
        {selectedRoute && (
          <Button
            title={`Start Navigation (${selectedRoute.duration_min} min • ${selectedRoute.distance_km} km)`}
            onPress={handleStartNav}
            variant="primary"
            size="lg"
            icon={<Navigation size={18} color="#090D16" />}
            style={{ marginTop: 12, marginBottom: 20 }}
          />
        )}
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
  addIconBtn: {
    padding: 6,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.cardElevated,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  optimizerBanner: {
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.primary,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
    gap: 12,
  },
  bannerLeft: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: THEME.typography.sizes.sm,
    fontWeight: '700',
  },
  bannerSub: {
    color: THEME.colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
    lineHeight: 16,
  },
  addForm: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    marginBottom: THEME.spacing.md,
  },
  formTitle: {
    color: THEME.colors.text,
    fontSize: THEME.typography.sizes.sm,
    fontWeight: '700',
    marginBottom: 10,
  },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  priorityLabel: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.typography.sizes.xs,
  },
  priorityBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  pBtn: {
    backgroundColor: THEME.colors.cardElevated,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  pBtnActive: {
    borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.primaryGlow,
  },
  pBtnText: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  pBtnTextActive: {
    color: THEME.colors.primaryLight,
  },
  section: {
    marginBottom: THEME.spacing.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    color: THEME.colors.text,
    fontSize: THEME.typography.sizes.md,
    fontWeight: '700',
  },
  sectionSub: {
    color: THEME.colors.textMuted,
    fontSize: 10,
  },
});
