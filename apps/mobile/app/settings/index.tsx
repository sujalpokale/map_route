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
import { useAuthStore } from '@/stores/useAuthStore';
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
