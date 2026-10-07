import React, { useEffect, useRef, useState } from 'react';
import { Alert, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { ActivityIndicator } from 'react-native';
import { CheckCircle2, Clock3, Crosshair, FileText, Fuel, ListPlus, MapPin, Navigation, ScanLine } from 'lucide-react-native';

import { THEME } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { MapViewAbstraction } from '@/components/map/MapViewAbstraction';
import { ocrService } from '@/services/api/ocr';
import { useOCRLocationStore } from '@/stores/useOCRLocationStore';
import { useNavigationStore } from '@/stores/useNavigationStore';
import { useRouteStore } from '@/stores/useRouteStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { useVehicleStore } from '@/stores/useVehicleStore';
import { trafficService } from '@/services/api/traffic';
import { GeoPoint } from '@/types';

interface RouteEstimate {
  distanceKm: number;
  durationMin: number;
  fuelLitres: number;
  trafficAvailable: boolean;
}

export default function OCRLocationScreen() {
  const router = useRouter();
  const { result, setResult } = useOCRLocationStore();
  const { setDestination, addStop, calculateRoutes, getSelectedRoute } = useRouteStore();
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const selectedVehicle = useVehicleStore((state) => state.getSelectedVehicle());
  const { startNavigation } = useNavigationStore();
  const [isResolving, setIsResolving] = useState(false);
  const [isStartingNavigation, setIsStartingNavigation] = useState(false);
  const [isLoadingEstimate, setIsLoadingEstimate] = useState(false);
  const [routeEstimate, setRouteEstimate] = useState<RouteEstimate | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [showRecognizedText, setShowRecognizedText] = useState(false);
  const estimateRequestId = useRef(0);
  const returnToScanner = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/trips');
    }
  };

  const hasMapPoint = Boolean(result && result.latitude !== null && result.longitude !== null);

  useEffect(() => {
    if (!result) {
      setRouteEstimate(null);
      setEstimateError(null);
      return;
    }
    if (!hasMapPoint) {
      setRouteEstimate(null);
      setEstimateError('A matched map location is needed for the route estimate.');
      return;
    }

    const requestId = ++estimateRequestId.current;
    const loadEstimate = async () => {
      setIsLoadingEstimate(true);
      setEstimateError(null);

      try {
        let origin: GeoPoint | null = null;
        if (currentLocation) {
          origin = {
            lat: currentLocation.latitude,
            lng: currentLocation.longitude,
            name: 'Your live location',
            address: 'Current GPS location',
          };
        } else {
          let permission = await Location.getForegroundPermissionsAsync();
          if (!permission.granted) {
            permission = await Location.requestForegroundPermissionsAsync();
          }
          if (!permission.granted) {
            throw new Error('Allow location access to calculate distance, travel time, and fuel from your current position.');
          }

          const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          origin = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            name: 'Your live location',
            address: 'Current GPS location',
          };
        }

        const destination: GeoPoint = {
          lat: result.latitude!,
          lng: result.longitude!,
          name: result.cleanedAddress.split(',')[0] || 'Scanned Location',
          address: result.cleanedAddress,
          city: result.city,
          state: result.state,
        };
        // Use standard driving directions for Google Maps-like distance and ETA.
        // Vehicle-specific speed adjustments belong to fleet planning, not this estimate.
        const response = await trafficService.calculateTrafficAwareRoute({
          origin,
          destination,
          waypoints: [],
          vehicle_type: selectedVehicle.vehicle_type,
          fuel_type: selectedVehicle.fuel_type,
          fuel_efficiency_kmpl: selectedVehicle.efficiency_kmpl,
          fuel_price_inr: selectedVehicle.fuel_price_inr,
        });
        if (requestId !== estimateRequestId.current) return;
        if (!response?.routes.length) {
          throw new Error('A driving route could not be found for this location.');
        }

        const route = response.routes.find((candidate) => candidate.id === response.best_route_id) || response.routes[0];
        setRouteEstimate({
          distanceKm: route.distance_km,
          durationMin: route.duration_min,
          fuelLitres: route.fuel_litres,
          trafficAvailable: Boolean(response.metadata?.traffic_available),
        });
      } catch (error) {
        if (requestId !== estimateRequestId.current) return;
        setRouteEstimate(null);
        setEstimateError(error instanceof Error ? error.message : 'Route estimate is unavailable.');
      } finally {
        if (requestId === estimateRequestId.current) setIsLoadingEstimate(false);
      }
    };

    loadEstimate();
    return () => {
      estimateRequestId.current += 1;
    };
  }, [hasMapPoint, result, currentLocation, selectedVehicle]);

  if (!result) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title="OCR Location" showBack onBack={returnToScanner} />
        <View style={styles.emptyState}>
          <ScanLine size={40} color={THEME.colors.textMuted} />
          <Text style={styles.emptyTitle}>No scanned location yet</Text>
          <TouchableOpacity style={styles.scanButton} onPress={() => router.replace('/(tabs)/trips')}>
            <Text style={styles.scanButtonText}>Open OCR Scanner</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const setMapPoint = async (coords: { latitude: number; longitude: number }) => {
    setResult({ ...result, latitude: coords.latitude, longitude: coords.longitude });
    setIsResolving(true);
    try {
      const reverse = await ocrService.reverseGeocode(coords.latitude, coords.longitude);
      if (reverse) {
        setResult({
          ...result,
          cleanedAddress: reverse.address || result.cleanedAddress,
          city: reverse.city || result.city,
          state: reverse.state || result.state,
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
      }
    } finally {
      setIsResolving(false);
    }
  };

  const requireMapPoint = () => {
    if (result.latitude === null || result.longitude === null) {
      Alert.alert('Location Pin Required', 'Tap the map to set a location before continuing.');
      return false;
    }
    return true;
  };

  const handleStartNavigation = async () => {
    if (!requireMapPoint()) return;

    const destination = {
      lat: result.latitude!,
      lng: result.longitude!,
      name: result.cleanedAddress.split(',')[0] || 'Scanned Location',
      address: result.cleanedAddress,
      city: result.city,
      state: result.state,
    };

    setIsStartingNavigation(true);
    try {
      setDestination(destination);
      const routeCalculated = await calculateRoutes();
      const route = getSelectedRoute();
      if (!routeCalculated || !route) {
        Alert.alert('Route Unavailable', 'We could not calculate a route to this location. Please adjust the map pin and try again.');
        return;
      }

      startNavigation(route.steps, route.distance_km, route.duration_min, route.coordinates);
      router.push({ pathname: '/navigation/[routeId]', params: { routeId: route.id } });
    } catch {
      Alert.alert('Navigation Error', 'Unable to start navigation for this location.');
    } finally {
      setIsStartingNavigation(false);
    }
  };

  const handleAddToMultiStop = () => {
    if (!requireMapPoint()) return;

    addStop({
      id: `ocr_stop_${Date.now()}`,
      name: result.cleanedAddress.split(',')[0] || 'Scanned Location',
      address: result.cleanedAddress,
      lat: result.latitude!,
      lng: result.longitude!,
      priority: 1,
      time_window_start: '09:00',
      time_window_end: '18:00',
      is_locked: false,
      status: 'PENDING',
    });
    router.replace('/(tabs)/routes');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        title="OCR Location"
        subtitle="Address extracted from photo"
        showBack
        onBack={returnToScanner}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.addressPanel}>
          <View style={styles.panelHeader}>
            <MapPin size={18} color={THEME.colors.primaryLight} />
            <Text style={styles.panelTitle}>Extracted Address</Text>
            <View style={styles.verifiedBadge}>
              <CheckCircle2 size={13} color={THEME.colors.success} />
              <Text style={styles.verifiedText}>{Math.round(result.confidenceScore * 100)}% match</Text>
            </View>
          </View>
          <Text style={styles.addressText}>{result.cleanedAddress}</Text>
          {Boolean(result.rawExtractedText?.trim()) && (
            <View style={styles.rawTextSection}>
              <TouchableOpacity
                style={styles.rawTextToggle}
                onPress={() => setShowRecognizedText((visible) => !visible)}
                accessibilityRole="button"
                accessibilityState={{ expanded: showRecognizedText }}
              >
                <FileText size={15} color={THEME.colors.primaryLight} />
                <Text style={styles.rawTextToggleLabel}>{showRecognizedText ? 'Hide recognized text' : 'View all recognized text'}</Text>
              </TouchableOpacity>
              {showRecognizedText && <Text style={styles.rawText}>{result.rawExtractedText}</Text>}
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>City</Text>
            <Text style={styles.detailValue}>{result.city || 'Not detected'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>State</Text>
            <Text style={styles.detailValue}>{result.state || 'Not detected'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>PIN code</Text>
            <Text style={styles.detailValue}>{result.pincode || 'Not detected'}</Text>
          </View>
        </View>

        <View style={styles.estimatePanel}>
          <View style={styles.panelHeader}>
            <Navigation size={18} color={THEME.colors.primaryLight} />
            <Text style={styles.panelTitle}>Trip Estimate</Text>
            <Text style={styles.estimateOrigin}>From live location</Text>
          </View>
          {isLoadingEstimate ? (
            <View style={styles.estimateMessage}>
              <ActivityIndicator size="small" color={THEME.colors.primaryLight} />
              <Text style={styles.estimateMessageText}>Getting route, travel time, and fuel...</Text>
            </View>
          ) : routeEstimate ? (
            <>
              <View style={styles.metricsRow}>
                <View style={styles.metricItem}>
                  <Navigation size={16} color={THEME.colors.primaryLight} />
                  <Text style={styles.metricValue}>{routeEstimate.distanceKm.toFixed(1)} km</Text>
                  <Text style={styles.metricLabel}>Distance</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricItem}>
                  <Clock3 size={16} color={THEME.colors.warning} />
                  <Text style={styles.metricValue}>{routeEstimate.durationMin} min</Text>
                  <Text style={styles.metricLabel}>Drive time</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricItem}>
                  <Fuel size={16} color={THEME.colors.success} />
                  <Text style={styles.metricValue}>{selectedVehicle.vehicle_type === 'EV'
                    ? `${routeEstimate.fuelLitres.toFixed(1)} kWh`
                    : `${routeEstimate.fuelLitres.toFixed(1)} L`}</Text>
                  <Text style={styles.metricLabel}>{selectedVehicle.vehicle_type === 'EV' ? 'Est. energy' : 'Est. fuel'}</Text>
                </View>
              </View>
              {!routeEstimate.trafficAvailable && (
                <Text style={styles.estimateError}>Traffic data unavailable. Distance and time use standard routing.</Text>
              )}
            </>
          ) : (
            <Text style={styles.estimateError}>{estimateError}</Text>
          )}
        </View>

        <View style={styles.mapPanel}>
          <View style={styles.panelHeader}>
            <Navigation size={18} color={THEME.colors.primaryLight} />
            <Text style={styles.panelTitle}>Matched Location</Text>
            {isResolving && <Text style={styles.syncingText}>Updating...</Text>}
          </View>
          <View style={styles.mapFrame}>
            <MapViewAbstraction
              destination={hasMapPoint ? {
                lat: result.latitude!,
                lng: result.longitude!,
                name: result.cleanedAddress.split(',')[0] || 'OCR Location',
                address: result.cleanedAddress,
                city: result.city,
                state: result.state,
              } : null}
              focusedLocation={hasMapPoint ? {
                latitude: result.latitude!,
                longitude: result.longitude!,
                zoom: 16,
              } : null}
              onMapPress={setMapPoint}
              showControls
              interactive
            />
          </View>
          <Text style={styles.mapHint}>
            {hasMapPoint
              ? `${result.latitude!.toFixed(5)}, ${result.longitude!.toFixed(5)}`
              : 'No point was matched. Tap the map to set the location.'}
          </Text>
        </View>

        <View style={styles.actionGroup}>
          <TouchableOpacity
            style={[styles.actionButton, styles.startNavigationButton, isStartingNavigation && styles.actionButtonDisabled]}
            onPress={handleStartNavigation}
            disabled={isStartingNavigation}
          >
            <Navigation size={19} color={THEME.colors.textInverse} />
            <Text style={styles.doneButtonText}>{isStartingNavigation ? 'Calculating Route...' : 'Set Location & Start Navigation'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.multiStopButton]} onPress={handleAddToMultiStop}>
            <ListPlus size={19} color={THEME.colors.primaryLight} />
            <Text style={styles.multiStopButtonText}>Add Point to Multi-Stop</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.scanAnotherButton} onPress={() => router.replace('/(tabs)/trips')}>
            <Crosshair size={16} color={THEME.colors.textSecondary} />
            <Text style={styles.scanAnotherText}>Scan Another Address</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  content: { padding: THEME.spacing.screen, paddingBottom: 32, gap: 16 },
  addressPanel: { backgroundColor: THEME.colors.card, borderWidth: 1, borderColor: THEME.colors.cardBorder, borderRadius: THEME.radius.md, padding: THEME.spacing.md, gap: 10 },
  estimatePanel: { backgroundColor: THEME.colors.card, borderWidth: 1, borderColor: THEME.colors.cardBorder, borderRadius: THEME.radius.md, padding: THEME.spacing.md, gap: 12 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  panelTitle: { color: THEME.colors.text, fontSize: THEME.typography.sizes.md, fontWeight: '700', flex: 1 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: THEME.colors.successGlow, borderWidth: 1, borderColor: THEME.colors.success, borderRadius: THEME.radius.xs, paddingHorizontal: 7, paddingVertical: 3 },
  verifiedText: { color: THEME.colors.success, fontSize: 10, fontWeight: '700' },
  addressText: { color: THEME.colors.text, fontSize: THEME.typography.sizes.base, lineHeight: 23, fontWeight: '600' },
  rawTextSection: { borderTopWidth: 1, borderTopColor: THEME.colors.cardBorder, paddingTop: 8, gap: 8 },
  rawTextToggle: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 7 },
  rawTextToggleLabel: { color: THEME.colors.primaryLight, fontSize: THEME.typography.sizes.xs, fontWeight: '700' },
  rawText: { color: THEME.colors.textSecondary, fontSize: THEME.typography.sizes.xs, lineHeight: 18 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: THEME.colors.cardBorder, paddingTop: 8 },
  detailLabel: { color: THEME.colors.textMuted, fontSize: THEME.typography.sizes.xs },
  detailValue: { color: THEME.colors.textSecondary, fontSize: THEME.typography.sizes.xs, fontWeight: '700' },
  estimateOrigin: { color: THEME.colors.textMuted, fontSize: 10, fontWeight: '600' },
  estimateMessage: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  estimateMessageText: { color: THEME.colors.textSecondary, fontSize: THEME.typography.sizes.xs },
  estimateError: { color: THEME.colors.warning, fontSize: THEME.typography.sizes.xs, lineHeight: 17 },
  metricsRow: { minHeight: 74, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  metricItem: { flex: 1, alignItems: 'center', gap: 4 },
  metricValue: { color: THEME.colors.text, fontSize: THEME.typography.sizes.md, fontWeight: '800' },
  metricLabel: { color: THEME.colors.textMuted, fontSize: 10, fontWeight: '600' },
  metricDivider: { width: 1, height: 42, backgroundColor: THEME.colors.cardBorder },
  mapPanel: { gap: 9 },
  mapFrame: { height: 330, overflow: 'hidden', borderRadius: THEME.radius.md, borderWidth: 1, borderColor: THEME.colors.cardBorder },
  mapHint: { color: THEME.colors.textSecondary, fontSize: THEME.typography.sizes.xs, textAlign: 'center' },
  syncingText: { color: THEME.colors.primaryLight, fontSize: 11, fontWeight: '600' },
  actionGroup: { gap: 10 },
  actionButton: { height: 50, borderRadius: THEME.radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  startNavigationButton: { backgroundColor: THEME.colors.primaryLight },
  multiStopButton: { backgroundColor: THEME.colors.card, borderWidth: 1, borderColor: THEME.colors.primary },
  actionButtonDisabled: { opacity: 0.65 },
  doneButtonText: { color: THEME.colors.textInverse, fontSize: THEME.typography.sizes.sm, fontWeight: '800' },
  multiStopButtonText: { color: THEME.colors.primaryLight, fontSize: THEME.typography.sizes.sm, fontWeight: '800' },
  scanAnotherButton: { height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  scanAnotherText: { color: THEME.colors.textSecondary, fontSize: THEME.typography.sizes.xs, fontWeight: '700' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  emptyTitle: { color: THEME.colors.text, fontSize: THEME.typography.sizes.md, fontWeight: '700' },
  scanButton: { backgroundColor: THEME.colors.primaryLight, borderRadius: THEME.radius.md, paddingHorizontal: 18, paddingVertical: 11 },
  scanButtonText: { color: THEME.colors.textInverse, fontSize: THEME.typography.sizes.sm, fontWeight: '700' },
});
