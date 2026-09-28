import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  User,
  Truck,
  Package,
  Camera,
  Settings,
  Shield,
  LogOut,
  ChevronRight,
  BatteryCharging,
  Fuel,
  Award,
} from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { useAuthStore } from '@/stores/useAuthStore';
import { useVehicleStore } from '@/stores/useVehicleStore';
import { Button } from '@/components/ui/Button';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { vehicles, selectedVehicleId, selectVehicle } = useVehicleStore();

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Driver Profile & Telematics" subtitle={user?.organization || 'Commercial Logistics'} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Card */}
        <View style={styles.userCard}>
          <View style={styles.avatarCircle}>
            <User size={28} color="#090D16" />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name || 'Sujal Pokale'}</Text>
            <Text style={styles.userRole}>ROLE: {user?.role || 'COMMERCIAL DRIVER'}</Text>
            <Text style={styles.userEmail}>{user?.email || 'driver@routeintelligence.ai'}</Text>
          </View>
        </View>

        {/* Lifetime Telematics Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Award size={16} color={THEME.colors.primaryLight} />
            <Text style={styles.statNumber}>{user?.total_trips || 142}</Text>
            <Text style={styles.statLabel}>Trips Logged</Text>
          </View>
          <View style={styles.statBox}>
            <Fuel size={16} color={THEME.colors.success} />
            <Text style={[styles.statNumber, { color: THEME.colors.success }]}>
              {user?.total_fuel_saved_litres || 128.4} L
            </Text>
            <Text style={styles.statLabel}>Fuel Saved</Text>
          </View>
          <View style={styles.statBox}>
            <Truck size={16} color={THEME.colors.warning} />
            <Text style={styles.statNumber}>{Math.round(user?.total_distance_km || 3840)} km</Text>
            <Text style={styles.statLabel}>Total Distance</Text>
          </View>
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
                    {veh.license_plate} • {veh.fuel_type} • {veh.efficiency_kmpl} km/L
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

        {/* Feature Shortcuts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tools & Workflows</Text>

          <TouchableOpacity
            onPress={() => router.push('/deliveries')}
            style={styles.menuItem}
          >
            <Package size={18} color={THEME.colors.primaryLight} />
            <Text style={styles.menuText}>Delivery Manifest & POD</Text>
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
