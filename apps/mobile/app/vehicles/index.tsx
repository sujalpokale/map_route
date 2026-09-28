import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Truck,
  BatteryCharging,
  Zap,
  Fuel,
  CheckCircle,
  Plus,
  Scale,
  Gauge,
} from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { useVehicleStore } from '@/stores/useVehicleStore';

export default function VehiclesScreen() {
  const { vehicles, selectedVehicleId, selectVehicle, updateBattery } =
    useVehicleStore();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        title="Fleet Vehicle Profiles"
        subtitle="Aerodynamics, physics calibration, and EV battery charge"
        showBack
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {vehicles.map((veh) => {
          const isSelected = veh.id === selectedVehicleId;
          const isEV = veh.vehicle_type === 'EV';

          return (
            <TouchableOpacity
              key={veh.id}
              activeOpacity={0.8}
              onPress={() => selectVehicle(veh.id)}
              style={[styles.card, isSelected && styles.cardActive]}
            >
              {/* Header Row */}
              <View style={styles.cardHeader}>
                <View style={styles.titleGroup}>
                  <View style={styles.iconCircle}>
                    {isEV ? (
                      <BatteryCharging size={20} color={THEME.colors.success} />
                    ) : (
                      <Truck size={20} color={THEME.colors.primaryLight} />
                    )}
                  </View>
                  <View>
                    <Text style={styles.vehName}>{veh.name}</Text>
                    <Text style={styles.vehPlate}>{veh.license_plate}</Text>
                  </View>
                </View>

                {isSelected && (
                  <View style={styles.selectedPill}>
                    <CheckCircle size={12} color={THEME.colors.primaryLight} />
                    <Text style={styles.selectedText}>SELECTED</Text>
                  </View>
                )}
              </View>

              {/* Physical Parameters Grid */}
              <View style={styles.specsGrid}>
                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>Fuel / Energy</Text>
                  <Text style={styles.specVal}>{veh.fuel_type}</Text>
                </View>

                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>Efficiency</Text>
                  <Text style={styles.specVal}>
                    {veh.efficiency_kmpl} {isEV ? 'km/kWh' : 'km/L'}
                  </Text>
                </View>

                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>Curb Weight</Text>
                  <Text style={styles.specVal}>{veh.curb_weight_kg} kg</Text>
                </View>

                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>Max Payload</Text>
                  <Text style={styles.specVal}>{veh.max_payload_kg} kg</Text>
                </View>
              </View>

              {/* EV Battery Slider if Electric */}
              {isEV && (
                <View style={styles.evSection}>
                  <View style={styles.evTop}>
                    <Text style={styles.evLabel}>Current State of Charge (SOC)</Text>
                    <Text style={styles.evPct}>{veh.ev_current_battery_pct || 78}%</Text>
                  </View>

                  <View style={styles.batteryTrack}>
                    <View
                      style={[
                        styles.batteryFill,
                        { width: `${veh.ev_current_battery_pct || 78}%` },
                      ]}
                    />
                  </View>

                  <View style={styles.evBottom}>
                    <Text style={styles.rangeText}>
                      Est. Range: {veh.ev_range_km || 312} km
                    </Text>
                    <TouchableOpacity
                      onPress={() => updateBattery(Math.min(100, (veh.ev_current_battery_pct || 78) + 10))}
                      style={styles.chargeBtn}
                    >
                      <Zap size={11} color={THEME.colors.success} />
                      <Text style={styles.chargeBtnText}>+10% Charge</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
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
  card: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg,
    borderWidth: 1.5,
    borderColor: THEME.colors.cardBorder,
    padding: THEME.spacing.md,
    marginBottom: 14,
  },
  cardActive: {
    borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.cardHover,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehName: {
    color: THEME.colors.text,
    fontSize: THEME.typography.sizes.sm,
    fontWeight: '700',
  },
  vehPlate: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  selectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.primaryGlow,
    borderWidth: 1,
    borderColor: THEME.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radius.full,
  },
  selectedText: {
    color: THEME.colors.primaryLight,
    fontSize: 10,
    fontWeight: '800',
  },
  specsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.cardElevated,
    borderRadius: THEME.radius.md,
    padding: 10,
  },
  specItem: {
    alignItems: 'center',
  },
  specLabel: {
    color: THEME.colors.textMuted,
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  specVal: {
    color: THEME.colors.text,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  evSection: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.cardBorder,
  },
  evTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  evLabel: {
    color: THEME.colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  evPct: {
    color: THEME.colors.success,
    fontSize: 12,
    fontWeight: '800',
  },
  batteryTrack: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: THEME.radius.full,
    overflow: 'hidden',
    marginBottom: 8,
  },
  batteryFill: {
    height: '100%',
    backgroundColor: THEME.colors.success,
    borderRadius: THEME.radius.full,
  },
  evBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rangeText: {
    color: THEME.colors.textMuted,
    fontSize: 11,
  },
  chargeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radius.xs,
    borderWidth: 1,
    borderColor: THEME.colors.success,
  },
  chargeBtnText: {
    color: THEME.colors.success,
    fontSize: 10,
    fontWeight: '700',
  },
});
