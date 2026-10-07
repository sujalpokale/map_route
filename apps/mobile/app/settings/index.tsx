import React, { useEffect, useMemo, useState } from 'react';
import { Alert, View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Volume2,
  Map,
  Zap,
  Shield,
  Gauge,
  Sliders,
  ChevronRight,
  Fuel,
  Car,
  Save,
} from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useVehicleStore } from '@/stores/useVehicleStore';
import { useRouteStore } from '@/stores/useRouteStore';
import { authApi } from '@/services/api/auth';
import { VehicleType } from '@/types';

export default function SettingsScreen() {
  const {
    settings,
    updateSettings,
    toggleVoiceGuidance,
    toggleDarkMap,
    setDefaultOptimization,
  } = useSettingsStore();

  const {
    vehicles,
    selectedVehicleId,
    selectVehicle,
    updateVehicleEconomics,
  } = useVehicleStore();

  const [mileageDraft, setMileageDraft] = useState('');

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === selectedVehicleId) || vehicles[0],
    [vehicles, selectedVehicleId]
  );

  const vehicleTypes = useMemo(() => {
    const seen = new Set<VehicleType>();
    return vehicles.filter((vehicle) => {
      if (seen.has(vehicle.vehicle_type)) return false;
      seen.add(vehicle.vehicle_type);
      return true;
    });
  }, [vehicles]);

  useEffect(() => {
    setMileageDraft(String(selectedVehicle?.efficiency_kmpl ?? ''));
  }, [selectedVehicle?.id, selectedVehicle?.efficiency_kmpl]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        title="Settings & Preferences"
        subtitle="Navigation parameters, units, and telematics privacy"
        showBack
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Vehicle & Fuel Efficiency */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle & Fuel Efficiency</Text>

          <View style={styles.vehicleSettingsCard}>
            <View style={styles.vehicleSettingsHeader}>
              <View style={styles.vehicleSettingsTitleWrap}>
                <Car size={18} color={THEME.colors.primaryLight} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>Vehicle Type</Text>
                  <Text style={styles.rowSub}>
                    Used for route, fuel, and cost calculations
                  </Text>
                </View>
              </View>
              <Text style={styles.selectedVehicleLabel}>
                {selectedVehicle?.vehicle_type || 'CAR'}
              </Text>
            </View>

            <View style={styles.vehicleTypeGrid}>
              {vehicleTypes.map((vehicle) => {
                const active = vehicle.id === selectedVehicleId;
                return (
                  <TouchableOpacity
                    key={vehicle.id}
                    style={[styles.vehicleTypeChip, active && styles.vehicleTypeChipActive]}
                    onPress={() => {
                      selectVehicle(vehicle.id);
                      setMileageDraft(String(vehicle.efficiency_kmpl));
                    }}
                    activeOpacity={0.82}
                  >
                    <Text style={[styles.vehicleTypeText, active && styles.vehicleTypeTextActive]}>
                      {vehicle.vehicle_type}
                    </Text>
                    <Text style={styles.vehicleTypeSub}>
                      {vehicle.vehicle_type === 'EV' ? 'Electric' : vehicle.fuel_type}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.fuelInputRow}>
              <View style={styles.fuelInputLabelWrap}>
                <Fuel size={17} color={THEME.colors.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>Average Efficiency</Text>
                  <Text style={styles.rowSub}>
                    Enter your real-world average
                  </Text>
                </View>
              </View>

              <View style={styles.mileageInputWrap}>
                <TextInput
                  value={mileageDraft}
                  onChangeText={setMileageDraft}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                  style={styles.mileageInput}
                  placeholder="e.g. 16.5"
                  placeholderTextColor={THEME.colors.textMuted}
                  accessibilityLabel="Average vehicle efficiency"
                />
                <Text style={styles.mileageUnit}>
                  {selectedVehicle?.vehicle_type === 'EV' ? 'km/kWh' : 'km/L'}
                </Text>
              </View>
            </View>

            <Text style={styles.fuelFormula}>
              Fuel/energy estimate = route distance ÷ your average efficiency.
            </Text>

            <TouchableOpacity
              style={styles.saveVehicleButton}
              onPress={async () => {
                const efficiency = Number(mileageDraft);
                if (!selectedVehicle) return;

                if (!Number.isFinite(efficiency) || efficiency <= 0 || efficiency > 500) {
                  Alert.alert(
                    'Invalid average',
                    selectedVehicle.vehicle_type === 'EV'
                      ? 'Enter a valid km/kWh value.'
                      : 'Enter a valid km/L value.'
                  );
                  return;
                }

                const vehicleSettings = Object.fromEntries(
                  vehicles.map((vehicle) => [
                    vehicle.id,
                    {
                      efficiency_kmpl:
                        vehicle.id === selectedVehicle.id
                          ? efficiency
                          : vehicle.efficiency_kmpl,
                      fuel_price_inr: vehicle.fuel_price_inr,
                    },
                  ])
                );

                const response = await authApi.updatePreferences({
                  selected_vehicle_id: selectedVehicle.id,
                  vehicle_settings: vehicleSettings,
                });

                if (!response.data) {
                  Alert.alert(
                    'Could not save',
                    response.error || 'Please try again.'
                  );
                  return;
                }

                updateVehicleEconomics(
                  selectedVehicle.id,
                  efficiency,
                  selectedVehicle.fuel_price_inr
                );

                const routeStore = useRouteStore.getState();
                if (routeStore.origin && routeStore.destination) {
                  await routeStore.calculateRoutes(selectedVehicle.vehicle_type);
                }

                Alert.alert(
                  'Vehicle settings saved',
                  selectedVehicle.vehicle_type === 'EV'
                    ? 'Your km/kWh value will be used for future energy estimates.'
                    : 'Your km/L value will be used for future fuel estimates.'
                );
              }}
              activeOpacity={0.82}
            >
              <Save size={16} color="#090D16" />
              <Text style={styles.saveVehicleButtonText}>Save Vehicle & Mileage</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Navigation & Audio Guidance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Audio & Turn Navigation</Text>

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Volume2 size={18} color={THEME.colors.primaryLight} />
              <View>
                <Text style={styles.rowTitle}>Voice Audio Guidance</Text>
                <Text style={styles.rowSub}>Spoken turn warnings and corridor alerts</Text>
              </View>
            </View>
            <Switch
              value={settings.voiceGuidanceEnabled}
              onValueChange={toggleVoiceGuidance}
              trackColor={{ false: '#334155', true: THEME.colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Zap size={18} color={THEME.colors.warning} />
              <View>
                <Text style={styles.rowTitle}>Auto-Reroute Threshold</Text>
                <Text style={styles.rowSub}>Trigger detour if &gt; {settings.autoRerouteThresholdMin} min saved</Text>
              </View>
            </View>
            <Text style={styles.thresholdVal}>{settings.autoRerouteThresholdMin} min</Text>
          </View>
        </View>

        {/* Map Display */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Map & Visual Aesthetics</Text>

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Map size={18} color={THEME.colors.secondary} />
              <View>
                <Text style={styles.rowTitle}>Dark Mode Vector Map</Text>
                <Text style={styles.rowSub}>High contrast night navigation palette</Text>
              </View>
            </View>
            <Switch
              value={settings.darkMapEnabled}
              onValueChange={toggleDarkMap}
              trackColor={{ false: '#334155', true: THEME.colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Unit Systems */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Units & Currency</Text>

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Gauge size={18} color={THEME.colors.textSecondary} />
              <View>
                <Text style={styles.rowTitle}>Distance Unit</Text>
                <Text style={styles.rowSub}>Kilometers (km) vs Miles (mi)</Text>
              </View>
            </View>
            <View style={styles.pillGroup}>
              <TouchableOpacity
                onPress={() => updateSettings({ units: 'metric' })}
                style={[styles.pill, settings.units === 'metric' && styles.pillActive]}
              >
                <Text style={[styles.pillText, settings.units === 'metric' && styles.pillTextActive]}>
                  KM
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => updateSettings({ units: 'imperial' })}
                style={[styles.pill, settings.units === 'imperial' && styles.pillActive]}
              >
                <Text style={[styles.pillText, settings.units === 'imperial' && styles.pillTextActive]}>
                  MI
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Telematics & Privacy */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Telematics & Privacy</Text>

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Shield size={18} color={THEME.colors.success} />
              <View>
                <Text style={styles.rowTitle}>Telemetry Location Privacy</Text>
                <Text style={styles.rowSub}>End-to-end encrypted telemetry pings</Text>
              </View>
            </View>
            <Text style={styles.activePill}>SECURE</Text>
          </View>
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    padding: 14,
    marginBottom: 8,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 10,
  },
  rowTitle: {
    color: THEME.colors.text,
    fontSize: THEME.typography.sizes.sm,
    fontWeight: '600',
  },
  rowSub: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  thresholdVal: {
    color: THEME.colors.warning,
    fontSize: 12,
    fontWeight: '800',
  },
  pillGroup: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: THEME.colors.cardElevated,
    padding: 3,
    borderRadius: THEME.radius.md,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radius.sm,
  },
  pillActive: {
    backgroundColor: THEME.colors.primary,
  },
  pillText: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  pillTextActive: {
    color: '#090D16',
  },
  vehicleSettingsCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    padding: 14,
  },
  vehicleSettingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  vehicleSettingsTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  selectedVehicleLabel: {
    color: THEME.colors.primaryLight,
    fontSize: 11,
    fontWeight: '900',
    backgroundColor: THEME.colors.primaryGlow,
    borderRadius: THEME.radius.xs,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  vehicleTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  vehicleTypeChip: {
    minWidth: '30%',
    flexGrow: 1,
    backgroundColor: THEME.colors.cardElevated,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    borderRadius: THEME.radius.sm,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  vehicleTypeChipActive: {
    borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.primaryGlow,
  },
  vehicleTypeText: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  vehicleTypeTextActive: {
    color: THEME.colors.primaryLight,
  },
  vehicleTypeSub: {
    color: THEME.colors.textMuted,
    fontSize: 9,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  fuelInputRow: {
    backgroundColor: THEME.colors.cardElevated,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    padding: 11,
    gap: 10,
  },
  fuelInputLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  mileageInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.card,
    overflow: 'hidden',
  },
  mileageInput: {
    width: 110,
    minHeight: 44,
    paddingHorizontal: 12,
    color: THEME.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  mileageUnit: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    paddingRight: 12,
  },
  fuelFormula: {
    color: THEME.colors.textMuted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 10,
  },
  saveVehicleButton: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.primaryLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  saveVehicleButtonText: {
    color: '#090D16',
    fontSize: 12,
    fontWeight: '900',
  },
  activePill: {
    color: THEME.colors.success,
    fontSize: 10,
    fontWeight: '800',
    backgroundColor: THEME.colors.successGlow,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radius.xs,
    borderWidth: 1,
    borderColor: THEME.colors.success,
  },
});
