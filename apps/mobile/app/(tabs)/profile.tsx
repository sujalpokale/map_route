import React, { useEffect, useState } from 'react';
import { Alert, View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  User,
  Truck,
  Camera,
  Settings,
  LogOut,
  ChevronRight,
  BatteryCharging,
  Award,
  Copy,
  Pencil,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { THEME } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { useAuthStore } from '@/stores/useAuthStore';
import { useVehicleStore } from '@/stores/useVehicleStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { authApi } from '@/services/api/auth';
import { useRouteStore } from '@/stores/useRouteStore';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, account, subscription, logout, updateProfile, isLoading, clearError } = useAuthStore();
  const { vehicles, selectedVehicleId, selectVehicle, updateVehicleEconomics } = useVehicleStore();
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(user?.name || '');
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === selectedVehicleId) || vehicles[0];
  const [efficiencyDraft, setEfficiencyDraft] = useState(String(selectedVehicle.efficiency_kmpl));
  const [fuelPriceDraft, setFuelPriceDraft] = useState(String(selectedVehicle.fuel_price_inr));
  const [savingVehicle, setSavingVehicle] = useState(false);

  useEffect(() => { setNameDraft(user?.name || ''); }, [user?.name]);
  useEffect(() => {
    setEfficiencyDraft(String(selectedVehicle.efficiency_kmpl));
    setFuelPriceDraft(String(selectedVehicle.fuel_price_inr));
  }, [selectedVehicle.id, selectedVehicle.efficiency_kmpl, selectedVehicle.fuel_price_inr]);

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const copyUserId = async () => {
    if (!account?.user_id) return;
    await Clipboard.setStringAsync(account.user_id);
    Alert.alert('Copied', 'User ID copied to clipboard.');
  };

  const saveName = async () => {
    clearError();
    if (await updateProfile({ name: nameDraft.trim() })) setEditingName(false);
    else Alert.alert('Could not update profile', useAuthStore.getState().error || 'Please try again.');
  };

  const saveVehicleEconomics = async () => {
    const efficiency = Number(efficiencyDraft);
    const fuelPrice = Number(fuelPriceDraft);
    if (!Number.isFinite(efficiency) || efficiency <= 0 || efficiency > 500) {
      Alert.alert('Check average efficiency', 'Enter a value greater than 0 and no more than 500.');
      return;
    }
    if (!Number.isFinite(fuelPrice) || fuelPrice <= 0 || fuelPrice > 10000) {
      Alert.alert('Check fuel price', 'Enter a value greater than 0 and no more than 10,000.');
      return;
    }

    const vehicleSettings = Object.fromEntries(vehicles.map((vehicle) => [
      vehicle.id,
      {
        efficiency_kmpl: vehicle.id === selectedVehicle.id ? efficiency : vehicle.efficiency_kmpl,
        fuel_price_inr: vehicle.id === selectedVehicle.id ? fuelPrice : vehicle.fuel_price_inr,
      },
    ]));
    setSavingVehicle(true);
    const response = await authApi.updatePreferences({ vehicle_settings: vehicleSettings });
    setSavingVehicle(false);
    if (!response.data) {
      Alert.alert('Could not save vehicle settings', response.error || 'Please try again.');
      return;
    }

    updateVehicleEconomics(selectedVehicle.id, efficiency, fuelPrice);
    const routeStore = useRouteStore.getState();
    if (routeStore.origin && routeStore.destination) {
      void routeStore.calculateRoutes(selectedVehicle.vehicle_type);
    }
    Alert.alert('Vehicle settings saved', 'Route fuel and cost estimates will use these values.');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="My Profile" subtitle="Account and subscription" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Card */}
        <View style={styles.userCard}>
          <View style={styles.avatarCircle}>
            <User size={28} color="#090D16" />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name || 'Account'}</Text>
            <Text style={styles.userRole}>ROLE: {account?.role?.toUpperCase() || 'USER'}</Text>
            <Text style={styles.userEmail}>{user?.email || ''}</Text>
          </View>
          {!editingName ? <TouchableOpacity onPress={() => setEditingName(true)} accessibilityLabel="Edit profile name" style={styles.copyButton}><Pencil size={17} color={THEME.colors.primaryLight} /></TouchableOpacity> : null}
        </View>

        {editingName ? <View style={styles.accountDetails}>
          <Input label="Name" value={nameDraft} onChangeText={setNameDraft} autoCapitalize="words" />
          <Text style={styles.detailHint}>Email and phone changes require verification and are not available yet.</Text>
          <View style={styles.editActions}>
            <Button title="Cancel" onPress={() => { setEditingName(false); setNameDraft(user?.name || ''); }} variant="secondary" size="sm" />
            <Button title="Save name" onPress={saveName} loading={isLoading} disabled={!nameDraft.trim()} size="sm" />
          </View>
        </View> : null}

        <View style={styles.accountDetails}>
          <Text style={styles.detailLabel}>USER ID</Text>
          <View style={styles.userIdRow}>
            <Text selectable style={styles.detailValue}>{account?.user_id || 'Unavailable'}</Text>
            {account?.user_id ? <TouchableOpacity onPress={copyUserId} accessibilityLabel="Copy user ID" style={styles.copyButton}><Copy size={16} color={THEME.colors.primaryLight} /></TouchableOpacity> : null}
          </View>
          <Text style={styles.detailLabel}>ACCOUNT STATUS</Text>
          <Text style={styles.detailValue}>{account?.status || 'Unavailable'}</Text>
          <Text style={styles.detailLabel}>MEMBER SINCE</Text>
          <Text style={styles.detailValue}>{account?.created_at ? new Date(account.created_at).toLocaleDateString() : 'Unavailable'}</Text>
          <Text style={styles.detailLabel}>SUBSCRIPTION</Text>
          <Text style={styles.detailValue}>{subscription?.plan?.toUpperCase() || 'FREE'} · {subscription?.status || 'active'}</Text>
          {subscription?.expiry_date ? <Text style={styles.detailHint}>Valid until {new Date(subscription.expiry_date).toLocaleDateString()}</Text> : null}
        </View>

        {/* Vehicle Fleet Garage */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Assigned Vehicles ({vehicles.length})</Text>
            <TouchableOpacity onPress={() => router.push('/vehicles')}>
              <Text style={styles.linkText}>Manage Garage →</Text>
            </TouchableOpacity>
          </View>

          {vehicles.map((veh) => {
            const isSelected = veh.id === selectedVehicleId;
            return (
              <TouchableOpacity
                key={veh.id}
                onPress={() => selectVehicle(veh.id)}
                style={[styles.vehicleCard, isSelected && styles.vehicleCardActive]}
              >
                <View style={styles.vehIcon}>
                  {veh.vehicle_type === 'EV' ? (
                    <BatteryCharging size={18} color={THEME.colors.success} />
                  ) : (
                    <Truck size={18} color={THEME.colors.primaryLight} />
                  )}
                </View>

                <View style={styles.vehDetails}>
                  <Text style={styles.vehName}>{veh.name}</Text>
                  <Text style={styles.vehPlate}>
                    {veh.license_plate} • {veh.efficiency_kmpl} {veh.vehicle_type === 'EV' ? 'km/kWh' : 'km/L'} • ₹{veh.fuel_price_inr}/{veh.vehicle_type === 'EV' ? 'kWh' : 'L'}
                  </Text>
                </View>

                {isSelected ? (
                  <View style={styles.activeTag}>
                    <Text style={styles.activeTagText}>ACTIVE</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.accountDetails}>
          <Text style={styles.sectionTitle}>Vehicle fuel estimates</Text>
          <Text style={styles.detailHint}>Select a vehicle above, then enter its real-world average and local fuel or electricity price.</Text>
          <Text style={styles.detailLabel}>AVERAGE ({selectedVehicle.vehicle_type === 'EV' ? 'KM/KWH' : 'KM/L'})</Text>
          <TextInput
            value={efficiencyDraft}
            onChangeText={setEfficiencyDraft}
            keyboardType="decimal-pad"
            selectTextOnFocus
            style={styles.economicsInput}
            accessibilityLabel="Vehicle average efficiency"
          />
          <Text style={styles.detailLabel}>PRICE (₹/{selectedVehicle.vehicle_type === 'EV' ? 'KWH' : 'L'})</Text>
          <TextInput
            value={fuelPriceDraft}
            onChangeText={setFuelPriceDraft}
            keyboardType="decimal-pad"
            selectTextOnFocus
            style={styles.economicsInput}
            accessibilityLabel="Fuel or electricity price"
          />
          <Button title="Save vehicle settings" onPress={saveVehicleEconomics} loading={savingVehicle} disabled={savingVehicle} size="sm" />
        </View>

        {/* Feature Shortcuts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tools & Workflows</Text>

          <TouchableOpacity
            onPress={() => router.push('/premium')}
            style={styles.menuItem}
          >
            <Award size={18} color={THEME.colors.warning} />
            <Text style={styles.menuText}>Manage Premium</Text>
            <ChevronRight size={18} color={THEME.colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/ocr/scan')}
            style={styles.menuItem}
          >
            <Camera size={18} color={THEME.colors.warning} />
            <Text style={styles.menuText}>OCR Waybill Scanner</Text>
            <ChevronRight size={18} color={THEME.colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/settings')}
            style={styles.menuItem}
          >
            <Settings size={18} color={THEME.colors.textSecondary} />
            <Text style={styles.menuText}>System Settings & Navigation Rules</Text>
            <ChevronRight size={18} color={THEME.colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Sign Out */}
        <Button
          title="Sign Out of Fleet Gateway"
          onPress={handleLogout}
          variant="danger"
          size="md"
          icon={<LogOut size={16} color="#FFFFFF" />}
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
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    marginBottom: 16,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: THEME.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: THEME.typography.sizes.md,
    fontWeight: '800',
  },
  userRole: {
    color: THEME.colors.primaryLight,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  userEmail: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  accountDetails: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    padding: 14,
    marginBottom: 20,
  },
  detailLabel: { color: THEME.colors.textMuted, fontSize: 10, fontWeight: '700', marginTop: 8 },
  detailValue: { color: THEME.colors.text, fontSize: 14, fontWeight: '600', marginTop: 3 },
  economicsInput: {
    minHeight: 46,
    paddingHorizontal: 12,
    marginTop: 5,
    marginBottom: 7,
    color: THEME.colors.text,
    backgroundColor: THEME.colors.cardElevated,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    borderRadius: THEME.radius.sm,
    fontSize: 15,
  },
  userIdRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  copyButton: { padding: 8 },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  detailHint: { color: THEME.colors.textSecondary, fontSize: 12, marginTop: 4 },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    backgroundColor: THEME.colors.cardElevated,
    borderRadius: THEME.radius.md,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  statNumber: {
    color: THEME.colors.text,
    fontSize: THEME.typography.sizes.md,
    fontWeight: '800',
    marginTop: 4,
  },
  statLabel: {
    color: THEME.colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    color: THEME.colors.text,
    fontSize: THEME.typography.sizes.md,
    fontWeight: '700',
  },
  linkText: {
    color: THEME.colors.primaryLight,
    fontSize: THEME.typography.sizes.xs,
    fontWeight: '600',
  },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    padding: 12,
    marginBottom: 8,
  },
  vehicleCardActive: {
    borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.cardHover,
  },
  vehIcon: {
    marginRight: 10,
  },
  vehDetails: {
    flex: 1,
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
  activeTag: {
    backgroundColor: THEME.colors.primaryGlow,
    borderWidth: 1,
    borderColor: THEME.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: THEME.radius.xs,
  },
  activeTagText: {
    color: THEME.colors.primaryLight,
    fontSize: 9,
    fontWeight: '800',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    padding: 14,
    marginBottom: 8,
  },
  menuText: {
    color: THEME.colors.text,
    fontSize: THEME.typography.sizes.sm,
    fontWeight: '600',
    flex: 1,
    marginLeft: 12,
  },
});
