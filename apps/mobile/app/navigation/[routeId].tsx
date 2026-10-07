import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Volume2, VolumeX, Navigation2, Flag, Lock, Unlock, LocateFixed, CheckCircle2 } from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { MapViewAbstraction } from '@/components/map/MapViewAbstraction';
import { TurnManeuverCard } from '@/components/navigation/TurnManeuverCard';
import { SpeedometerHUD } from '@/components/navigation/SpeedometerHUD';
import { TripProgressBar } from '@/components/navigation/TripProgressBar';
import { Button } from '@/components/ui/Button';
import { useRouteStore } from '@/stores/useRouteStore';
import { useNavigationStore } from '@/stores/useNavigationStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { useTripStore } from '@/stores/useTripStore';
import { useVehicleStore } from '@/stores/useVehicleStore';
import { trafficService } from '@/services/api/traffic';
import * as Location from 'expo-location';

export default function ActiveNavigationScreen() {
  const router = useRouter();
  const { routeId } = useLocalSearchParams();
  const { getSelectedRoute, origin, destination } = useRouteStore();
  const {
    isNavigating,
    isRerouting,
    hasArrived,
    trafficLevel,
    currentRoad,
    nextTurnManeuver,
    distanceToNextTurnM,
    remainingDistanceKm,
    remainingDurationMin,
    eta,
    progressPct,
    isDeviated,
    stopNavigation,
    updateLocation,
    setRerouting,
    setTrafficLevel,
    replaceRoute,
    activeRoute,
    routeOrigin,
    routeDestination,
    routeWaypoints,
    routeMetadata,
  } = useNavigationStore();
  const { currentLocation, speedKmh, setLocation, setTracking } = useLocationStore();
  const { completeActiveTrip } = useTripStore();
  const selectedVehicle = useVehicleStore((state) => state.getSelectedVehicle());

  const [voiceMuted, setVoiceMuted] = useState(false);
  const [cameraLocked, setCameraLocked] = useState(true);
  const [gpsReady, setGpsReady] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const rerouteStarted = useRef(false);
  // Multi-Stop navigation passes its route context through useNavigationStore.
  // Single Route navigation continues to use the legacy route store fallback.
  const selectedRoute = activeRoute || getSelectedRoute();
  const navigationOrigin = routeOrigin || origin;
  const navigationDestination = routeDestination || destination;
  const navigationWaypoints = routeWaypoints.length ? routeWaypoints : useRouteStore.getState().waypoints;

  useEffect(() => {
    if (!isNavigating || hasArrived) return;
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;
    const beginGps = async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setGpsError('Location permission is required for live guidance and off-route detection.');
        return;
      }
      setGpsError(null);
      setTracking(true);
      subscription = await Location.watchPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: Math.max(1, Number(process.env.EXPO_PUBLIC_NAVIGATION_LOCATION_UPDATE_SECONDS || 1)) * 1000,
        distanceInterval: 3,
      }, (position) => {
        if (cancelled) return;
        const { latitude, longitude, heading, speed, accuracy } = position.coords;
        const liveLocation = { latitude, longitude, heading: heading ?? 0, speed: speed ?? 0, accuracy: accuracy ?? 999, timestamp: position.timestamp || Date.now() };
        setLocation(liveLocation);
        setGpsReady(true);
        const target = useNavigationStore.getState().routeDestination || useRouteStore.getState().destination;
        updateLocation(latitude, longitude, Math.max(0, (speed ?? 0) * 3.6), accuracy ?? 999, target || undefined);
      });
    };
    beginGps().catch((error) => setGpsError(error instanceof Error ? error.message : 'Unable to start GPS tracking.'));
    return () => {
      cancelled = true;
      subscription?.remove();
      setTracking(false);
    };
  }, [isNavigating, hasArrived, setLocation, setTracking, updateLocation]);

  useEffect(() => {
    if (!isNavigating) return;
    const pollTraffic = () => {
      const live = useLocationStore.getState().currentLocation;
      if (!live) return;
      trafficService.getTrafficStatus({ lat: live.latitude, lng: live.longitude, name: 'Current GPS location' })
        .then((status) => setTrafficLevel(status?.traffic_available ? status.traffic_level : 'Unavailable'))
        .catch(() => setTrafficLevel('Unavailable'));
    };
    pollTraffic();
    const timer = setInterval(pollTraffic, 60_000);
    return () => clearInterval(timer);
  }, [isNavigating, setTrafficLevel]);

  useEffect(() => {
    if (!isDeviated) {
      rerouteStarted.current = false;
      return;
    }
    if (!isNavigating || isRerouting || rerouteStarted.current || !currentLocation || !navigationDestination) return;
    rerouteStarted.current = true;
    setRerouting(true);
    const reroute = async () => {
      try {
        const response = await trafficService.calculateTrafficAwareRoute({
          origin: { lat: currentLocation.latitude, lng: currentLocation.longitude, name: 'Current GPS location' },
          destination: navigationDestination,
          waypoints: navigationWaypoints,
          vehicle_type: selectedVehicle.vehicle_type,
          fuel_type: selectedVehicle.fuel_type,
          fuel_efficiency_kmpl: selectedVehicle.efficiency_kmpl,
          fuel_price_inr: selectedVehicle.fuel_price_inr,
          avoid_features: routeMetadata?.avoid_features || useRouteStore.getState().metadata?.avoid_features || [],
        });
        const route = response?.routes.find((candidate) => candidate.id === response.best_route_id) || response?.routes[0];
        if (!route) throw new Error('No new route is available from your current location.');
        if (useNavigationStore.getState().activeRoute) {
          useNavigationStore.setState({
            activeRoute: route,
            routeOrigin: useLocationStore.getState().currentLocation
              ? {
                  lat: useLocationStore.getState().currentLocation!.latitude,
                  lng: useLocationStore.getState().currentLocation!.longitude,
                  name: 'Current GPS location',
                }
              : navigationOrigin,
          });
        } else {
          useRouteStore.setState({
            candidateRoutes: response!.routes,
            selectedRouteId: route.id,
            metadata: response!.metadata,
          });
        }
        replaceRoute(route.steps || [], route.distance_km, route.duration_min, route.coordinates);
      } catch (error) {
        setRerouting(false);
        setGpsError(error instanceof Error ? error.message : 'Automatic rerouting failed. Keep following your current road and retry.');
      }
    };
    reroute();
  }, [isDeviated, isNavigating, isRerouting, currentLocation, navigationDestination, navigationWaypoints, navigationOrigin, setRerouting, replaceRoute]);

  useEffect(() => {
    if (!isNavigating) return;
    let busy = false;
    let active = true;
    const checkTrafficAlternative = async () => {
      if (busy || useNavigationStore.getState().isDeviated) return;
      const location = useLocationStore.getState().currentLocation;
      const legacyRouteState = useRouteStore.getState();
      const navigation = useNavigationStore.getState();
      const route = navigation.activeRoute || legacyRouteState.getSelectedRoute();
      const targetDestination = navigation.routeDestination || legacyRouteState.destination;
      const effectiveRouteMetadata = navigation.routeMetadata || legacyRouteState.metadata;
      const waypoints = navigation.routeWaypoints.length
        ? navigation.routeWaypoints
        : legacyRouteState.waypoints;
      if (!location || !route || !targetDestination || !effectiveRouteMetadata?.traffic_available) return;
      busy = true;
      try {
        const suggestion = await trafficService.requestReroute({
          currentLocation: { lat: location.latitude, lng: location.longitude, name: 'Current GPS location' },
          destination: targetDestination,
          currentRouteId: String(routeId || route.id),
          remainingRouteTimeSeconds: Math.max(0, Math.round(navigation.remainingDurationMin * 60)),
          waypoints,
          avoidFeatures: effectiveRouteMetadata?.avoid_features || [],
        });
        if (!active || !suggestion?.reroute_available || !suggestion.traffic_available || !suggestion.recommended_route) return;
        const alternative = suggestion.recommended_route;
        Alert.alert(
          'Faster route found',
          `Live traffic indicates a ${suggestion.time_saved_minutes} minute saving. Switch routes?`,
          [
            { text: 'Keep current route', style: 'cancel' },
            { text: 'Use faster route', onPress: () => {
              const updatedRoute = {
                ...route,
                id: alternative.id,
                label: alternative.label,
                coordinates: alternative.coordinates,
                distance_km: alternative.distance_km,
                duration_min: alternative.duration_min,
                traffic_delay_min: alternative.traffic_delay_min,
                traffic_level: alternative.traffic_level as typeof route.traffic_level,
                steps: alternative.steps,
                eta_iso: new Date(Date.now() + alternative.duration_min * 60_000).toISOString(),
                is_recommended: true,
              };
              if (useNavigationStore.getState().activeRoute) {
                useNavigationStore.setState({ activeRoute: updatedRoute });
              } else {
                useRouteStore.setState({
                  candidateRoutes: [updatedRoute],
                  selectedRouteId: updatedRoute.id,
                });
              }
              replaceRoute(updatedRoute.steps || [], updatedRoute.distance_km, updatedRoute.duration_min, updatedRoute.coordinates);
            } },
          ],
        );
      } finally {
        busy = false;
      }
    };
    const interval = Math.max(30, Number(process.env.EXPO_PUBLIC_ROUTE_RECALCULATION_INTERVAL_SECONDS || 30));
    const timer = setInterval(checkTrafficAlternative, interval * 1000);
    return () => { active = false; clearInterval(timer); };
  }, [isNavigating, routeId, replaceRoute]);

  useEffect(() => {
    if (!hasArrived) return;
    stopNavigation();
    completeActiveTrip(selectedRoute?.duration_min || 0, selectedRoute?.fuel_litres || 0, selectedRoute?.total_cost_inr || 0);
    Alert.alert('You have arrived', navigationDestination?.address || navigationDestination?.name || 'Destination reached.');
    router.replace('/(tabs)/trips');
  }, [hasArrived]);

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
              selectedRoute?.duration_min || 0,
              selectedRoute?.fuel_litres || 0,
              selectedRoute?.total_cost_inr || 0
            );
            router.replace('/(tabs)/trips');
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Full-bleed Vector Map */}
      <MapViewAbstraction
        origin={navigationOrigin}
        destination={navigationDestination}
        activeRoute={selectedRoute}
        activeProgressPct={progressPct}
        navigationMode
        cameraLocked={cameraLocked}
        onNavigationCameraInteraction={() => setCameraLocked(false)}
        onNavigationCameraLockChange={setCameraLocked}
        currentLocation={
          currentLocation
            ? {
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
                heading: currentLocation.heading ?? undefined,
              }
            : undefined
        }
        showControls
        onRecenter={() => undefined}
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

          <View style={styles.navStatusBadge}>
            {gpsReady ? <CheckCircle2 size={13} color="#34A853" /> : <LocateFixed size={13} color="#FBBC04" />}
            <Text style={styles.navStatusText}>
              {gpsReady ? (cameraLocked ? 'FOLLOWING' : 'EXPLORE MODE') : 'LOCATING GPS'}
            </Text>
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

      {/* Bottom Telematics HUD */}
      <SafeAreaView style={styles.bottomHUD} edges={['bottom']}>
        <View style={styles.speedRow}>
          <SpeedometerHUD
            currentSpeedKmh={speedKmh}
            speedLimitKmh={60}
            gpsAccuracyM={currentLocation?.accuracy || 6}
          />

          <View style={styles.statusStack}>
            <Text style={styles.statusText}>Traffic: {trafficLevel === 'Unavailable' ? 'Unavailable' : trafficLevel.toLowerCase()}</Text>
            {isRerouting && <Text style={styles.reroutingText}>Finding a new route...</Text>}
            {gpsError && <Text style={styles.reroutingText}>{gpsError}</Text>}
          </View>
        </View>

        <TripProgressBar
          progressPct={progressPct}
          remainingDistanceKm={remainingDistanceKm}
          remainingDurationMin={remainingDurationMin}
          etaString={eta ? new Date(eta).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '--'}
        />

        <View style={styles.navigationHintRow}>
          <Text style={styles.navigationHintText}>
            {cameraLocked ? 'Map follows your live GPS. Drag or pinch the map to explore.' : 'Map unlocked. Tap the lock/recenter control to follow GPS again.'}
          </Text>
          {!cameraLocked && (
            <TouchableOpacity style={styles.resumeFollowBtn} onPress={() => setCameraLocked(true)}>
              <Lock size={13} color="#FFFFFF" />
              <Text style={styles.resumeFollowText}>Resume</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.actionRow}>
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
  navStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: THEME.radius.full,
  },
  navStatusText: {
    color: '#E8EAED',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
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
  statusStack: { alignItems: 'flex-end', gap: 3, maxWidth: '55%' },
  statusText: { color: THEME.colors.text, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  reroutingText: { color: THEME.colors.warning, fontSize: 10, textAlign: 'right' },
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
  navigationHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: THEME.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  navigationHintText: {
    color: '#CBD5E1',
    fontSize: 9,
    lineHeight: 13,
    flex: 1,
  },
  resumeFollowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1A73E8',
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  resumeFollowText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
});
