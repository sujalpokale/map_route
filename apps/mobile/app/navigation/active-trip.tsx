import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Flag, Navigation, Clock, Fuel, IndianRupee, ShieldCheck } from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { StopList } from '@/components/route/StopList';
import { useMultiStopStore } from '@/stores/useMultiStopStore';
import { useNavigationStore } from '@/stores/useNavigationStore';

export default function ActiveTripSummaryScreen() {
  const router = useRouter();
  const { stops, toggleStopLock, removeStop, getSelectedRoute } = useMultiStopStore();
  const { remainingDistanceKm, remainingDurationMin } = useNavigationStore();

  const selectedRoute = getSelectedRoute();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Active Delivery Run Sheet" subtitle="Live waypoints & completion status" showBack />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Quick Progress Banner */}
        <View style={styles.banner}>
          <View style={styles.statBox}>
            <Clock size={16} color={THEME.colors.primaryLight} />
            <Text style={styles.statVal}>{remainingDurationMin} min</Text>
            <Text style={styles.statLabel}>Remaining</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.statBox}>
            <Navigation size={16} color={THEME.colors.secondary} />
            <Text style={styles.statVal}>{remainingDistanceKm} km</Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.statBox}>
            <Fuel size={16} color={THEME.colors.warning} />
            <Text style={styles.statVal}>{selectedRoute?.fuel_litres || 1.6} L</Text>
            <Text style={styles.statLabel}>Est. Fuel</Text>
          </View>
        </View>

        {/* Waypoints sequence */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Sequence</Text>
          <StopList
            stops={stops}
            onToggleLock={toggleStopLock}
            onRemoveStop={removeStop}
          />
        </View>

        <Button
          title="Return to Live Turn-by-Turn Navigation"
          onPress={() => router.back()}
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
  banner: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statVal: {
    color: THEME.colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  statLabel: {
    color: THEME.colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: THEME.colors.cardBorder,
    alignSelf: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: THEME.colors.text,
    fontSize: THEME.typography.sizes.md,
    fontWeight: '700',
    marginBottom: 10,
  },
});
