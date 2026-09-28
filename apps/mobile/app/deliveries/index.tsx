import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Package, CheckCircle2, Clock, Plus } from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { DeliveryCard } from '@/components/delivery/DeliveryCard';
import { ProofOfDeliveryModal } from '@/components/delivery/ProofOfDeliveryModal';
import { useDeliveryStore, DeliveryManifestItem } from '@/stores/useDeliveryStore';
import { useNavigationStore } from '@/stores/useNavigationStore';
import { useRouteStore } from '@/stores/useRouteStore';

export default function DeliveriesScreen() {
  const router = useRouter();
  const { deliveries, updateDeliveryStatus } = useDeliveryStore();
  const { startNavigation } = useNavigationStore();
  const { getSelectedRoute } = useRouteStore();

  const [activeProofModalId, setActiveProofModalId] = useState<string | null>(null);
  const selectedDelivery = deliveries.find((d) => d.id === activeProofModalId);

  const handleNavigate = (delivery: DeliveryManifestItem) => {
    const selectedRoute = getSelectedRoute();
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

  const handleMarkArrived = (id: string) => {
    updateDeliveryStatus(id, 'ARRIVED');
  };

  const handleConfirmProof = (proofData: { photoUrl?: string; signature?: string; notes?: string }) => {
    if (activeProofModalId) {
      updateDeliveryStatus(activeProofModalId, 'COMPLETED', proofData);
      setActiveProofModalId(null);
    }
  };

  const completedCount = deliveries.filter((d) => d.status === 'COMPLETED').length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        title="Delivery Run Manifest"
        subtitle={`${completedCount} of ${deliveries.length} packages delivered`}
        showBack
        rightAction={
          <TouchableOpacity
            onPress={() => router.push('/ocr/scan')}
            style={styles.scanBtn}
          >
            <Text style={styles.scanBtnText}>+ Scan Label</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status Tracker */}
        <View style={styles.statusBar}>
          <View style={styles.statusItem}>
            <Text style={styles.statusVal}>{deliveries.length}</Text>
            <Text style={styles.statusLabel}>Total Drops</Text>
          </View>
          <View style={styles.statusDivider} />
          <View style={styles.statusItem}>
            <Text style={[styles.statusVal, { color: THEME.colors.warning }]}>
              {deliveries.filter((d) => d.status === 'EN_ROUTE' || d.status === 'ARRIVED').length}
            </Text>
            <Text style={styles.statusLabel}>In Transit</Text>
          </View>
          <View style={styles.statusDivider} />
          <View style={styles.statusItem}>
            <Text style={[styles.statusVal, { color: THEME.colors.success }]}>
              {completedCount}
            </Text>
            <Text style={styles.statusLabel}>Completed</Text>
          </View>
        </View>

        {/* Deliveries List */}
        {deliveries.map((del) => (
          <DeliveryCard
            key={del.id}
            delivery={del}
            onNavigate={() => handleNavigate(del)}
            onMarkArrived={() => handleMarkArrived(del.id)}
            onOpenProofModal={() => setActiveProofModalId(del.id)}
          />
        ))}
      </ScrollView>

      {/* Proof of Delivery Modal */}
      {selectedDelivery && (
        <ProofOfDeliveryModal
          visible={!!activeProofModalId}
          onClose={() => setActiveProofModalId(null)}
          deliveryId={selectedDelivery.id}
          customerName={selectedDelivery.customer_name}
          onConfirm={handleConfirmProof}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  scanBtn: {
    backgroundColor: THEME.colors.primaryGlow,
    borderWidth: 1,
    borderColor: THEME.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radius.md,
  },
  scanBtnText: {
    color: THEME.colors.primaryLight,
    fontSize: 11,
    fontWeight: '700',
  },
  scrollContent: {
    padding: THEME.spacing.screen,
    paddingBottom: 30,
  },
  statusBar: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    padding: 12,
    marginBottom: 16,
  },
  statusItem: {
    flex: 1,
    alignItems: 'center',
  },
  statusVal: {
    color: THEME.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  statusLabel: {
    color: THEME.colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  statusDivider: {
    width: 1,
    height: 24,
    backgroundColor: THEME.colors.cardBorder,
    alignSelf: 'center',
  },
});
