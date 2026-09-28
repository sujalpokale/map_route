import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  Volume2,
  VolumeX,
  Navigation2,
  AlertTriangle,
  CheckCircle,
  Flag,
} from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { MapViewAbstraction } from '@/components/map/MapViewAbstraction';
import { TurnManeuverCard } from '@/components/navigation/TurnManeuverCard';
import { SpeedometerHUD } from '@/components/navigation/SpeedometerHUD';
import { TripProgressBar } from '@/components/navigation/TripProgressBar';
import { DeviationAlertBanner } from '@/components/navigation/DeviationAlertBanner';
import { Button } from '@/components/ui/Button';
import { useRouteStore } from '@/stores/useRouteStore';
import { useNavigationStore } from '@/stores/useNavigationStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { useTripStore } from '@/stores/useTripStore';

export default function ActiveNavigationScreen() {
  const router = useRouter();
  const { routeId } = useLocalSearchParams();

  const { getSelectedRoute, origin, destination } = useRouteStore();
  const {
    isNavigating,
    currentRoad,
    nextTurnManeuver,
    distanceToNextTurnM,
    remainingDistanceKm,
    remainingDurationMin,
    progressPct,
    isDeviated,
    deviationDistanceM,
    showRerouteModal,
    rerouteAlternative,
    stopNavigation,
    advanceStep,
    updateLiveProgress,
    triggerDeviation,
    dismissReroute,
    applyReroute,
  } = useNavigationStore();
  const { currentLocation, speedKmh } = useLocationStore();
  const { completeActiveTrip } = useTripStore();

  const [voiceMuted, setVoiceMuted] = useState(false);
  const selectedRoute = getSelectedRoute();

  // Simulated GPS progression loop
  useEffect(() => {
    const timer = setInterval(() => {
      updateLiveProgress(
        currentLocation?.latitude || 18.5204,
        currentLocation?.longitude || 73.8567,
        speedKmh || 42
      );
    }, 2500);

    return () => clearInterval(timer);
  }, [speedKmh]);

  const handleEndNavigation = () => {
    Alert.alert(
      'Finish Journey?',
      'Do you want to conclude this active navigation trip and log telematics?',
      [
        { text: 'Keep Driving', style: 'cancel' },
        {
          text: 'End & Log Trip',
          style: 'destructive',
          onPress: () => {
            stopNavigation();
            completeActiveTrip(
              selectedRoute?.duration_min || 34,
              selectedRoute?.fuel_litres || 1.6,
              selectedRoute?.total_cost_inr || 287
            );
            router.replace('/(tabs)/trips');
          },
        },
      ]
    );
  };

  const handleSimulateDeviation = () => {
    triggerDeviation(180); // 180 meters off-corridor
  };

  return (
    <View style={styles.container}>
      {/* Full-bleed Vector Map */}
      <MapViewAbstraction
        origin={origin}
        destination={destination}
        activeRoute={selectedRoute}
        currentLocation={
          currentLocation
            ? {
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
                heading: currentLocation.heading ?? undefined,
              }
            : undefined
        }
        showControls={false}
        style={styles.fullMap}
      />

      {/* Top Floating Turn Maneuver Card */}
      <SafeAreaView style={styles.topHUD} edges={['top']}>
        <View style={styles.topControlRow}>
          <TouchableOpacity
            onPress={handleEndNavigation}
            style={styles.circleBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.titleBadge}>
            <Navigation2 size={13} color={THEME.colors.primaryLight} />
            <Text style={styles.titleBadgeText}>LIVE NAVIGATION</Text>
          </View>

          <TouchableOpacity
            onPress={() => setVoiceMuted(!voiceMuted)}
            style={styles.circleBtn}
          >
            {voiceMuted ? (
              <VolumeX size={18} color={THEME.colors.danger} />
            ) : (
              <Volume2 size={18} color={THEME.colors.primaryLight} />
            )}
          </TouchableOpacity>
        </View>

        <TurnManeuverCard
          instruction={nextTurnManeuver}
          distanceToTurnM={distanceToNextTurnM}
          currentRoadName={currentRoad}
        />
      </SafeAreaView>

      {/* Dynamic Detour Alert Banner */}
      {showRerouteModal && (
        <View style={styles.alertOverlay}>
          <DeviationAlertBanner
            deviationM={deviationDistanceM}
            timeSavedMin={rerouteAlternative?.timeSavedMin || 8}
            onApplyReroute={applyReroute}
            onDismiss={dismissReroute}
          />
        </View>
      )}

      {/* Bottom Telematics HUD */}
      <SafeAreaView style={styles.bottomHUD} edges={['bottom']}>
        <View style={styles.speedRow}>
          <SpeedometerHUD
            currentSpeedKmh={speedKmh}
            speedLimitKmh={60}
            gpsAccuracyM={currentLocation?.accuracy || 6}
          />

          {/* Test button to simulate deviation */}
          <TouchableOpacity
            onPress={handleSimulateDeviation}
            style={styles.testDeviationBtn}
          >
            <AlertTriangle size={12} color={THEME.colors.warning} />
            <Text style={styles.testDeviationText}>Simulate Reroute</Text>
          </TouchableOpacity>
        </View>

        <TripProgressBar
          progressPct={progressPct}
          remainingDistanceKm={remainingDistanceKm}
          remainingDurationMin={remainingDurationMin}
          etaString={selectedRoute?.eta_iso || '11:15 AM'}
        />

        <View style={styles.actionRow}>
          <Button
            title="Next Maneuver Step"
            onPress={advanceStep}
            variant="secondary"
            size="md"
            style={{ flex: 1 }}
          />

          <Button
            title="Finish Trip"
            onPress={handleEndNavigation}
            variant="success"
            size="md"
            icon={<Flag size={16} color="#FFFFFF" />}
            style={{ flex: 1 }}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16',
    position: 'relative',
  },
  fullMap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    height: '100%',
  },
  topHUD: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: THEME.spacing.screen,
    zIndex: 20,
  },
  topControlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  titleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: THEME.colors.primary,
  },
  titleBadgeText: {
    color: THEME.colors.primaryLight,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  alertOverlay: {
    position: 'absolute',
    top: 190,
    left: 0,
    right: 0,
    zIndex: 30,
  },
  bottomHUD: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: THEME.spacing.screen,
    paddingBottom: 16,
    gap: 10,
    zIndex: 20,
  },
  speedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  testDeviationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.warning,
  },
  testDeviationText: {
    color: THEME.colors.warning,
    fontSize: 11,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
});
