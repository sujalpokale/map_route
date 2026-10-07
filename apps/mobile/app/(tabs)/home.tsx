import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Animated,
  PanResponder,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Search,
  Mic,
  Navigation,
  Compass,
  Package,
  Camera,
  Truck,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Fuel,
  Clock,
  IndianRupee,
  Zap,
  MapPin,
  X,
  Layers,
  Crosshair,
  Sliders,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  RotateCcw,
  Lock,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import { THEME } from '@/constants/theme';
import { MapViewAbstraction } from '@/components/map/MapViewAbstraction';
import { useAuthStore } from '@/stores/useAuthStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { useRouteStore } from '@/stores/useRouteStore';
import { useVehicleStore } from '@/stores/useVehicleStore';
import { useNavigationStore } from '@/stores/useNavigationStore';
import { geocodingService } from '@/services/api/geocoding';
import { GeoPoint, VehicleType } from '@/types';
import { usePremiumGate } from '@/services/premium';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SNAP_PEEK = 72;
const SNAP_HALF = Math.min(340, SCREEN_HEIGHT * 0.44);
const SNAP_FULL = Math.min(560, SCREEN_HEIGHT * 0.72);

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { currentLocation, speedKmh, updateCoordinates } = useLocationStore();
  const {
    origin,
    destination,
    candidateRoutes,
    selectedRouteId,
    setSelectedRouteId,
    calculateRoutes,
    isLoading,
    setOrigin,
    setDestination,
  } = useRouteStore();
  const { getSelectedVehicle, selectVehicle, vehicles } = useVehicleStore();
  const { startNavigation } = useNavigationStore();
  const { isPremium: hasMultiStopPremium, requirePremium: requireMultiStopPremium } = usePremiumGate('multi_stop_optimization');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeoPoint[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'all' | 'fast' | 'ev' | 'multistop' | 'gas'>('fast');
  const [sheetSnap, setSheetSnap] = useState<'PEEK' | 'HALF' | 'FULL'>('PEEK');

  const sheetHeightAnim = useRef(new Animated.Value(SNAP_PEEK)).current;
  const currentHeightRef = useRef(SNAP_PEEK);

  useEffect(() => {
    const id = sheetHeightAnim.addListener(({ value }) => {
      currentHeightRef.current = value;
    });
    return () => sheetHeightAnim.removeListener(id);
  }, []);

  const snapTo = (snap: 'PEEK' | 'HALF' | 'FULL') => {
    setSheetSnap(snap);
    const target = snap === 'PEEK' ? SNAP_PEEK : snap === 'HALF' ? SNAP_HALF : SNAP_FULL;
    Animated.spring(sheetHeightAnim, {
      toValue: target,
      useNativeDriver: false,
      friction: 9,
      tension: 65,
    }).start();
  };

  const toggleSheet = () => {
    if (sheetSnap === 'PEEK') {
      snapTo(destination ? 'HALF' : 'HALF');
    } else if (sheetSnap === 'HALF') {
      snapTo('FULL');
    } else {
      snapTo('PEEK');
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 3,
      onPanResponderMove: (_, gesture) => {
        const newHeight = currentHeightRef.current - gesture.dy;
        const clamped = Math.max(SNAP_PEEK, Math.min(SNAP_FULL + 20, newHeight));
        sheetHeightAnim.setValue(clamped);
      },
      onPanResponderRelease: (_, gesture) => {
        const cur = currentHeightRef.current - gesture.dy;
        if (gesture.vy < -0.4) {
          snapTo(cur > SNAP_HALF ? 'FULL' : 'HALF');
        } else if (gesture.vy > 0.4) {
          snapTo(cur < SNAP_HALF ? 'PEEK' : 'HALF');
        } else {
          const distPeek = Math.abs(cur - SNAP_PEEK);
          const distHalf = Math.abs(cur - SNAP_HALF);
          const distFull = Math.abs(cur - SNAP_FULL);
          const min = Math.min(distPeek, distHalf, distFull);
          if (min === distPeek) snapTo('PEEK');
          else if (min === distHalf) snapTo('HALF');
          else snapTo('FULL');
        }
      },
    })
  ).current;

  // Auto-acquire live device GPS location on mount & continuously track
  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          // 1. Instant Last Known Fix (0ms latency)
          const lastKnown = await Location.getLastKnownPositionAsync();
          if (lastKnown) {
            updateCoordinates(
              lastKnown.coords.latitude,
              lastKnown.coords.longitude,
              lastKnown.coords.speed ? lastKnown.coords.speed * 3.6 : 0,
              lastKnown.coords.heading,
              lastKnown.coords.accuracy,
              lastKnown.coords.altitude
            );
            setOrigin({
              lat: lastKnown.coords.latitude,
              lng: lastKnown.coords.longitude,
              name: 'Your Live Location',
              address: 'Acquiring GPS...',
            });
          }

          // 2. High-Accuracy Fresh Live Position
          const fresh = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          updateCoordinates(
            fresh.coords.latitude,
            fresh.coords.longitude,
            fresh.coords.speed ? fresh.coords.speed * 3.6 : 0,
            fresh.coords.heading,
            fresh.coords.accuracy,
            fresh.coords.altitude
          );

          // 3. Reverse Geocode to Real Local Area & City Name
          try {
            const geocodeResults = await Location.reverseGeocodeAsync({
              latitude: fresh.coords.latitude,
              longitude: fresh.coords.longitude,
            });
            if (geocodeResults && geocodeResults.length > 0) {
              const place = geocodeResults[0];
              const placeName = place.name || place.street || place.district || 'My Location';
              const fullAddr = [place.street, place.district, place.city, place.region].filter(Boolean).join(', ');
              setOrigin({
                lat: fresh.coords.latitude,
                lng: fresh.coords.longitude,
                name: placeName,
                address: fullAddr || 'Live GPS Location',
                city: place.city || place.district || '',
              });
            }
          } catch {
            setOrigin({
              lat: fresh.coords.latitude,
              lng: fresh.coords.longitude,
              name: 'Your Live Location',
              address: `${fresh.coords.latitude.toFixed(4)}, ${fresh.coords.longitude.toFixed(4)}`,
            });
          }

          // 4. Start Live GPS Stream
          locationSubscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: 2000,
              distanceInterval: 5,
            },
            (newLoc) => {
              updateCoordinates(
                newLoc.coords.latitude,
                newLoc.coords.longitude,
                newLoc.coords.speed ? newLoc.coords.speed * 3.6 : 0,
                newLoc.coords.heading,
                newLoc.coords.accuracy,
                newLoc.coords.altitude
              );
            }
          );
        }
      } catch {
        // Handled with fallback origin coordinates
      }
    })();

    return () => {
      locationSubscription?.remove();
    };
  }, []);

  const selectedVehicle = getSelectedVehicle();
  const selectedRoute =
    candidateRoutes.find((r) => r.id === selectedRouteId) || candidateRoutes[0];
  const searchTimeoutRef = useRef<any>(null);

  // Vehicle selector profile mapping
  const vehicleOptions: { type: VehicleType; label: string; icon: string; tag: string }[] = [
    { type: 'BIKE', label: 'Bike', icon: '🏍️', tag: '45 km/l • ₹0 Toll' },
    { type: 'CAR', label: 'Car', icon: '🚗', tag: '16.5 km/l' },
    { type: 'TRUCK', label: 'Truck', icon: '🚚', tag: '5.5 km/l • HCV Bypass' },
    { type: 'BUS', label: 'Bus', icon: '🚌', tag: '4.8 km/l • Transit' },
    { type: 'EV', label: 'EV', icon: '⚡', tag: '7.2 km/kWh' },
  ];

  const handleSelectVehicleType = (vType: VehicleType) => {
    const match = vehicles.find((v) => v.vehicle_type === vType);
    if (match) {
      selectVehicle(match.id);
    }
    calculateRoutes(vType);
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    if (text.trim().length >= 1) {
      setIsSearching(true);
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const userLoc = currentLocation
            ? { lat: currentLocation.latitude, lng: currentLocation.longitude }
            : origin?.lat && origin?.lng
            ? { lat: origin.lat, lng: origin.lng }
            : undefined;
          const results = await geocodingService.search(text, userLoc);
          setSearchResults(results);
        } catch {
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 75);
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  };

  const handleSelectPlace = (place: GeoPoint) => {
    setDestination(place);
    setSearchQuery(place.name || place.address || '');
    setSearchResults([]);
    setIsSearching(false);
    calculateRoutes(selectedVehicle.vehicle_type);
    snapTo('HALF');
  };

  const handleMapPress = async (coords: { latitude: number; longitude: number }) => {
    setIsSearching(true);
    try {
      const rev = await geocodingService.reverse(coords.latitude, coords.longitude);
      const place: GeoPoint = {
        lat: coords.latitude,
        lng: coords.longitude,
        name: rev?.address?.split(',')[0] || `Point (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`,
        address: rev?.address || `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`,
      };
      handleSelectPlace(place);
    } catch {
      handleSelectPlace({
        lat: coords.latitude,
        lng: coords.longitude,
        name: `Location (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`,
        address: `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`,
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleRecenter = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      updateCoordinates(
        loc.coords.latitude,
        loc.coords.longitude,
        loc.coords.speed == null ? null : loc.coords.speed * 3.6,
        loc.coords.heading,
        loc.coords.accuracy,
        loc.coords.altitude
      );
      const [place] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      const address = place
        ? [place.street, place.district, place.city, place.region].filter(Boolean).join(', ')
        : '';
      setOrigin({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        name: place?.name || place?.street || place?.district || 'Your Live Location',
        address: address || `${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)}`,
        city: place?.city || place?.district || '',
      });
    } catch {
      // fallback
    }
  };

  const handleStartNav = () => {
    if (selectedRoute) {
      startNavigation(
        selectedRoute.steps,
        selectedRoute.distance_km,
        selectedRoute.duration_min,
        selectedRoute.coordinates
      );
      router.push({
        pathname: '/navigation/[routeId]',
        params: { routeId: selectedRoute.id },
      });
    }
  };

  const isPeek = sheetSnap === 'PEEK';

  return (
    <View style={styles.container}>
      {/* 1. Full-Screen Google Maps Vector Canvas */}
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
        onMapPress={handleMapPress}
        onRecenter={handleRecenter}
        showControls
        style={styles.fullScreenMap}
      />

      {/* 2. Top Floating Google Maps Search & Vehicle Selection Bar */}
      <SafeAreaView style={styles.topOverlay} edges={['top']}>
        {/* Google Maps Search Pill Card */}
        <View style={styles.searchPill}>
          <Search size={20} color="#8AB4F8" style={{ marginLeft: 14 }} />
          <TextInput
            style={styles.searchInput}
            placeholder={destination?.name || "Search destination or address..."}
            placeholderTextColor={destination ? "#FFFFFF" : "#9AA0A6"}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery.length > 0 || destination ? (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                setSearchResults([]);
                setDestination(null as any);
                calculateRoutes();
                snapTo('PEEK');
              }}
              style={styles.searchIconBtn}
            >
              <X size={18} color="#BDC1C6" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/assistant')}
              style={styles.searchIconBtn}
            >
              <Mic size={19} color="#EA4335" />
            </TouchableOpacity>
          )}

          {/* Profile Circle Shortcut */}
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profile')}
            style={styles.profileAvatarPill}
          >
            <Text style={styles.avatarInitials}>
              {(user?.name || 'D').charAt(0).toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Quick Vehicle Type Selector Row (Bike, Car, Truck, Bus, EV) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.vehicleSelectorRow}
        >
          {vehicleOptions.map((vOpt) => {
            const isVehicleSelected = selectedVehicle.vehicle_type === vOpt.type;
            return (
              <TouchableOpacity
                key={vOpt.type}
                activeOpacity={0.8}
                style={[styles.vehiclePill, isVehicleSelected && styles.vehiclePillActive]}
                onPress={() => handleSelectVehicleType(vOpt.type)}
              >
                <Text style={styles.vehicleIcon}>{vOpt.icon}</Text>
                <View>
                  <Text style={[styles.vehiclePillLabel, isVehicleSelected && styles.vehiclePillLabelActive]}>
                    {vOpt.label}
                  </Text>
                  <Text style={[styles.vehiclePillTag, isVehicleSelected && styles.vehiclePillTagActive]}>
                    {vOpt.tag}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Feature Shortcut Chips Row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryChipsRow}
        >
          <TouchableOpacity
            style={styles.chip}
            onPress={() => {
              if (!hasMultiStopPremium) {
                requireMultiStopPremium();
                return;
              }
              router.push('/(tabs)/routes');
            }}
          >
            {hasMultiStopPremium ? <Sliders size={13} color="#FBBC04" /> : <Lock size={13} color="#FBBC04" />}
            <Text style={styles.chipText}>Multi-Stop VRP{hasMultiStopPremium ? '' : ' · PRO'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.chip}
            onPress={() => router.push('/ocr/scan')}
          >
            <Camera size={13} color="#8AB4F8" />
            <Text style={styles.chipText}>OCR Scan</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.chip}
            onPress={() => router.push('/vehicles')}
          >
            <Truck size={13} color="#34A853" />
            <Text style={styles.chipText}>Fleet Garage</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.chip}
            onPress={() => router.push('/(tabs)/assistant')}
          >
            <Sparkles size={13} color="#EA4335" />
            <Text style={styles.chipText}>AI Copilot</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Live Search Autocomplete Dropdown List */}
        {(searchResults.length > 0 || isSearching) && (
          <View style={styles.autocompleteCard}>
            {isSearching && (
              <View style={styles.searchingRow}>
                <ActivityIndicator size="small" color="#8AB4F8" />
                <Text style={styles.searchingText}>Searching points & addresses in real-time...</Text>
              </View>
            )}
            {searchResults.map((place, index) => (
              <TouchableOpacity
                key={index}
                style={styles.autocompleteItem}
                onPress={() => handleSelectPlace(place)}
                activeOpacity={0.7}
              >
                <View style={styles.pinIconWrap}>
                  <MapPin size={16} color="#8AB4F8" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <Text style={styles.autocompleteName} numberOfLines={1}>{place.name}</Text>
                    {place.city ? (
                      <View style={styles.cityTag}>
                        <Text style={styles.cityTagText}>{place.city}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.autocompleteAddr} numberOfLines={1}>{place.address}</Text>
                  {place.lat && place.lng ? (
                    <Text style={styles.coordBadge}>
                      {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
                    </Text>
                  ) : null}
                </View>
                <ArrowRight size={14} color="#9AA0A6" />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </SafeAreaView>

      {/* 3. Fully Adjustable & Draggable Bottom Sheet (Starts in PEEK mode on first visit) */}
      <Animated.View style={[styles.bottomSheet, { height: sheetHeightAnim }]}>
        {/* Gesture Drag Handle Area */}
        <View {...panResponder.panHandlers} style={styles.sheetHandleArea}>
          <View style={styles.sheetHandle} />
        </View>

        {/* PEEK Mode (Compact, non-intrusive Google Maps bottom bar) */}
        {isPeek ? (
          <TouchableOpacity
            style={styles.peekContentRow}
            onPress={toggleSheet}
            activeOpacity={0.8}
          >
            <View style={styles.peekLeftWrap}>
              <View style={styles.peekIconBg}>
                <MapPin size={16} color="#8AB4F8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.peekTitle} numberOfLines={1}>
                  {destination?.name
                    ? `${destination.name} (${Math.round(selectedRoute?.duration_min || 25)} min • ${selectedVehicle.vehicle_type})`
                    : origin?.name || (currentLocation ? 'Your Live Location' : 'Location unavailable')}
                </Text>
                <Text style={styles.peekSub} numberOfLines={1}>
                  {destination
                    ? `Best route for ${selectedVehicle.name} ready`
                    : origin?.address || (currentLocation
                      ? `${currentLocation.latitude.toFixed(5)}, ${currentLocation.longitude.toFixed(5)}`
                      : 'Allow location access to show your address')}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.peekExpandBtn} onPress={toggleSheet}>
              <ChevronUp size={16} color="#8AB4F8" />
              <Text style={styles.peekExpandText}>Open</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ) : (
          /* EXPANDED Mode (Half or Full Height) */
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.expandedScrollContent}
            bounces={false}
          >
            {/* If Active Route Selected: Show Route Summary & Multi-Objective Breakdown */}
            {selectedRoute ? (
              <View>
                {/* Active Vehicle Switcher Pills Inside Route Sheet */}
                <View style={styles.sheetVehicleSwitcherHeader}>
                  <Text style={styles.sheetVehicleSwitcherTitle}>Optimizing For Vehicle:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                    {vehicleOptions.map((vOpt) => {
                      const isVehActive = selectedVehicle.vehicle_type === vOpt.type;
                      return (
                        <TouchableOpacity
                          key={vOpt.type}
                          style={[styles.miniVehPill, isVehActive && styles.miniVehPillActive]}
                          onPress={() => handleSelectVehicleType(vOpt.type)}
                        >
                          <Text style={{ fontSize: 13 }}>{vOpt.icon}</Text>
                          <Text style={[styles.miniVehPillText, isVehActive && styles.miniVehPillTextActive]}>
                            {vOpt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Primary ETA Header */}
                <View style={styles.routeHeaderRow}>
                  <View>
                    <View style={styles.etaBadgeRow}>
                      <Text style={styles.etaMinutes}>{Math.round(selectedRoute.duration_min)} min</Text>
                      <View style={styles.trafficStatusPill}>
                        <Text style={styles.trafficStatusText}>
                          {selectedRoute.traffic_level || 'Fastest Route'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.routeSubDetail}>
                      {selectedRoute.distance_km} km • ETA{' '}
                      {new Date(Date.now() + selectedRoute.duration_min * 60000).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>

                  {/* Google Maps "Start" Navigation CTA */}
                  <TouchableOpacity style={styles.startNavBtn} onPress={handleStartNav}>
                    <Navigation size={18} color="#FFFFFF" />
                    <Text style={styles.startNavText}>Start</Text>
                  </TouchableOpacity>
                </View>

                {/* Multi-Objective 4-Pill Telematics Matrix (Time, Fuel, Cost, Distance) */}
                <View style={styles.multiObjectiveGrid}>
                  <View style={styles.objMetricCard}>
                    <View style={styles.objMetricIconRow}>
                      <Clock size={15} color="#8AB4F8" />
                      <Text style={styles.objMetricLabel}>Time</Text>
                    </View>
                    <Text style={styles.objMetricValue}>{Math.round(selectedRoute.duration_min)} min</Text>
                    <Text style={styles.objMetricSub}>
                      {selectedRoute.traffic_delay_min > 0 ? `+${selectedRoute.traffic_delay_min}m delay` : 'Free Flow'}
                    </Text>
                  </View>

                  <View style={styles.objMetricCard}>
                    <View style={styles.objMetricIconRow}>
                      <Fuel size={15} color="#FBBC04" />
                      <Text style={styles.objMetricLabel}>Fuel / Energy</Text>
                    </View>
                    <Text style={styles.objMetricValue}>
                      {selectedVehicle.vehicle_type === 'EV'
                        ? `${((selectedRoute.fuel_litres || 1.2) * 2.8).toFixed(1)} kWh`
                        : `${selectedRoute.fuel_litres || 1.2} L`}
                    </Text>
                    <Text style={styles.objMetricSub}>
                      {selectedVehicle.efficiency_kmpl} {selectedVehicle.vehicle_type === 'EV' ? 'km/kWh' : 'km/L'}
                    </Text>
                  </View>

                  <View style={styles.objMetricCard}>
                    <View style={styles.objMetricIconRow}>
                      <IndianRupee size={15} color="#34A853" />
                      <Text style={styles.objMetricLabel}>Total Cost</Text>
                    </View>
                    <Text style={styles.objMetricValue}>
                      ₹{Math.round(selectedRoute.total_cost_inr || selectedRoute.fuel_cost_inr || 140)}
                    </Text>
                    <Text style={styles.objMetricSub}>
                      {selectedRoute.toll_cost_inr > 0 ? `₹${selectedRoute.toll_cost_inr} toll incl.` : '₹0 Tolls'}
                    </Text>
                  </View>

                  <View style={styles.objMetricCard}>
                    <View style={styles.objMetricIconRow}>
                      <Compass size={15} color="#8AB4F8" />
                      <Text style={styles.objMetricLabel}>Distance</Text>
                    </View>
                    <Text style={styles.objMetricValue}>{selectedRoute.distance_km} km</Text>
                    <Text style={styles.objMetricSub}>Score: {Math.round(selectedRoute.overall_score || 95)}/100</Text>
                  </View>
                </View>

                {/* AI Route Recommendation Reason Banner */}
                {selectedRoute.recommendation_reason && (
                  <View style={styles.aiRecommendationBanner}>
                    <Sparkles size={16} color="#8AB4F8" style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.aiRecTitle}>
                        Smart Recommendation ({selectedVehicle.name})
                      </Text>
                      <Text style={styles.aiRecText}>
                        {selectedRoute.recommendation_reason}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Candidate Route Alternative Switchers */}
                <Text style={styles.sectionHeaderTitle}>Compare Alternative Routes</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.altRoutesRow}>
                  {candidateRoutes.map((r, i) => {
                    const isSelected = r.id === selectedRouteId;
                    return (
                      <TouchableOpacity
                        key={r.id || i}
                        onPress={() => setSelectedRouteId(r.id)}
                        style={[styles.altRouteCard, isSelected && styles.altRouteCardSelected]}
                      >
                        <Text style={[styles.altRouteName, isSelected && styles.altRouteNameSelected]}>
                          {r.label || `Route ${i + 1}`}
                        </Text>
                        <Text style={styles.altRouteTime}>{Math.round(r.duration_min)} min</Text>
                        <Text style={styles.altRouteCost}>₹{Math.round(r.total_cost_inr || r.fuel_cost_inr || 120)} • {r.distance_km} km</Text>
                        <Text style={styles.altRouteFuel}>
                          {selectedVehicle.vehicle_type === 'EV' ? `${((r.fuel_litres || 1) * 2.8).toFixed(1)} kWh` : `${r.fuel_litres || 1.1} L fuel`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Turn By Turn Steps Preview */}
                {selectedRoute.steps && selectedRoute.steps.length > 0 && (
                  <View style={styles.stepsPreviewBox}>
                    <Text style={styles.stepsPreviewTitle}>Directions Preview</Text>
                    {selectedRoute.steps.slice(0, 3).map((step, sIdx) => (
                      <View key={sIdx} style={styles.stepPreviewRow}>
                        <View style={styles.stepDot} />
                        <Text style={styles.stepPreviewText} numberOfLines={2}>
                          {step.instruction}
                        </Text>
                        <Text style={styles.stepPreviewDist}>
                          {step.distance_m > 1000 ? `${(step.distance_m / 1000).toFixed(1)} km` : `${step.distance_m} m`}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              /* Idle Google Maps Explore Sheet */
              <View>
                <View style={styles.idleHeaderRow}>
                  <View>
                    <Text style={styles.idleTitle}>Where to next?</Text>
                    <Text style={styles.idleSubtitle}>
                      Active Vehicle: <Text style={{ color: '#8AB4F8' }}>{selectedVehicle.name}</Text>
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => snapTo('PEEK')}
                      style={styles.fullMapPill}
                    >
                      <ChevronDown size={14} color="#BDC1C6" />
                      <Text style={styles.fullMapPillText}>Map Only</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => router.push('/vehicles')}
                      style={styles.switchVehicleBtn}
                    >
                      <Truck size={14} color="#8AB4F8" />
                      <Text style={styles.switchVehicleText}>Garage</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.locationSummary}>
                  <View style={styles.shortcutIconBg}>
                    <MapPin size={16} color="#8AB4F8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.locationSummaryLabel}>Current location</Text>
                    <Text style={styles.shortcutName} numberOfLines={1}>
                      {origin?.name || (currentLocation ? 'Your Live Location' : 'Waiting for location')}
                    </Text>
                    <Text style={styles.shortcutAddr} numberOfLines={2}>
                      {origin?.address || (currentLocation
                        ? `${currentLocation.latitude.toFixed(5)}, ${currentLocation.longitude.toFixed(5)}`
                        : 'Allow location access to show your address')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Refresh current location"
                    onPress={handleRecenter}
                    style={styles.locationRefreshButton}
                  >
                    <Crosshair size={18} color="#8AB4F8" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#202124',
  },
  fullScreenMap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    paddingHorizontal: 12,
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#303134',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    height: 52,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  searchInput: {
    flex: 1,
    color: '#E8EAED',
    fontSize: 15,
    fontWeight: '500',
    paddingHorizontal: 12,
  },
  searchIconBtn: {
    padding: 8,
  },
  profileAvatarPill: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1A73E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  categoryChipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#303134',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  chipActive: {
    backgroundColor: '#1A73E8',
    borderColor: '#1A73E8',
  },
  chipText: {
    color: '#BDC1C6',
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  autocompleteCard: {
    backgroundColor: '#303134',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    marginTop: 6,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
    maxHeight: 280,
  },
  searchingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  searchingText: {
    color: '#BDC1C6',
    fontSize: 12,
    fontWeight: '500',
  },
  autocompleteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  pinIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(26, 115, 232, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  autocompleteName: {
    color: '#E8EAED',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  cityTag: {
    backgroundColor: 'rgba(26, 115, 232, 0.18)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(26, 115, 232, 0.3)',
  },
  cityTagText: {
    color: '#8AB4F8',
    fontSize: 10,
    fontWeight: '700',
  },
  autocompleteAddr: {
    color: '#9AA0A6',
    fontSize: 11,
    marginTop: 2,
  },
  coordBadge: {
    color: '#8AB4F8',
    fontSize: 10,
    marginTop: 3,
    opacity: 0.8,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#202124',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.14)',
    paddingHorizontal: 16,
    zIndex: 35,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 14,
    overflow: 'hidden',
  },
  sheetHandleArea: {
    alignItems: 'center',
    paddingVertical: 10,
    width: '100%',
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#5F6368',
  },
  peekContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    gap: 12,
  },
  peekLeftWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  peekIconBg: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(26, 115, 232, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  peekTitle: {
    color: '#E8EAED',
    fontSize: 14,
    fontWeight: '700',
  },
  peekSub: {
    color: '#9AA0A6',
    fontSize: 11,
    marginTop: 1,
  },
  peekExpandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#303134',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  peekExpandText: {
    color: '#8AB4F8',
    fontSize: 11,
    fontWeight: '700',
  },
  expandedScrollContent: {
    paddingBottom: 28,
  },
  routeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  etaBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  etaMinutes: {
    color: '#34A853',
    fontSize: 26,
    fontWeight: '800',
  },
  trafficStatusPill: {
    backgroundColor: 'rgba(52, 168, 83, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(52, 168, 83, 0.3)',
  },
  trafficStatusText: {
    color: '#34A853',
    fontSize: 11,
    fontWeight: '700',
  },
  routeSubDetail: {
    color: '#BDC1C6',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  startNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1A73E8',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  startNavText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  altRoutesRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  altRouteCard: {
    backgroundColor: '#303134',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    minWidth: 105,
  },
  altRouteCardSelected: {
    borderColor: '#8AB4F8',
    backgroundColor: 'rgba(26, 115, 232, 0.2)',
  },
  altRouteName: {
    color: '#BDC1C6',
    fontSize: 11,
    fontWeight: '600',
  },
  altRouteNameSelected: {
    color: '#8AB4F8',
    fontWeight: '700',
  },
  altRouteTime: {
    color: '#E8EAED',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  altRouteCost: {
    color: '#9AA0A6',
    fontSize: 10,
    marginTop: 2,
  },
  telematicsStrip: {
    flexDirection: 'row',
    backgroundColor: '#303134',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 10,
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  stripItem: {
    alignItems: 'center',
    gap: 2,
  },
  stripLabel: {
    color: '#9AA0A6',
    fontSize: 9,
    fontWeight: '600',
  },
  stripValue: {
    color: '#E8EAED',
    fontSize: 11,
    fontWeight: '700',
  },
  stripDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  stepsPreviewBox: {
    backgroundColor: '#303134',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 8,
  },
  stepsPreviewTitle: {
    color: '#E8EAED',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  stepPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8AB4F8',
  },
  stepPreviewText: {
    color: '#BDC1C6',
    fontSize: 11,
    flex: 1,
  },
  stepPreviewDist: {
    color: '#9AA0A6',
    fontSize: 10,
    fontWeight: '600',
  },
  idleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  idleTitle: {
    color: '#E8EAED',
    fontSize: 18,
    fontWeight: '700',
  },
  idleSubtitle: {
    color: '#BDC1C6',
    fontSize: 12,
    marginTop: 2,
  },
  switchVehicleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#303134',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  switchVehicleText: {
    color: '#8AB4F8',
    fontSize: 11,
    fontWeight: '600',
  },
  fullMapPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#303134',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  fullMapPillText: {
    color: '#BDC1C6',
    fontSize: 11,
    fontWeight: '600',
  },
  vehicleSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 6,
  },
  vehiclePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#303134',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  vehiclePillActive: {
    backgroundColor: '#1A73E8',
    borderColor: '#8AB4F8',
  },
  vehicleIcon: {
    fontSize: 16,
  },
  vehiclePillLabel: {
    color: '#E8EAED',
    fontSize: 12,
    fontWeight: '700',
  },
  vehiclePillLabelActive: {
    color: '#FFFFFF',
  },
  vehiclePillTag: {
    color: '#9AA0A6',
    fontSize: 9,
    fontWeight: '500',
  },
  vehiclePillTagActive: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  sheetVehicleSwitcherHeader: {
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  sheetVehicleSwitcherTitle: {
    color: '#9AA0A6',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  miniVehPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#303134',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    marginRight: 6,
  },
  miniVehPillActive: {
    backgroundColor: '#1A73E8',
    borderColor: '#8AB4F8',
  },
  miniVehPillText: {
    color: '#BDC1C6',
    fontSize: 11,
    fontWeight: '600',
  },
  miniVehPillTextActive: {
    color: '#FFFFFF',
  },
  multiObjectiveGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 12,
  },
  objMetricCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#303134',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  objMetricIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  objMetricLabel: {
    color: '#9AA0A6',
    fontSize: 11,
    fontWeight: '600',
  },
  objMetricValue: {
    color: '#E8EAED',
    fontSize: 15,
    fontWeight: '700',
  },
  objMetricSub: {
    color: '#BDC1C6',
    fontSize: 10,
    marginTop: 2,
  },
  aiRecommendationBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(26, 115, 232, 0.15)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(138, 180, 248, 0.3)',
    padding: 12,
    marginBottom: 12,
  },
  aiRecTitle: {
    color: '#8AB4F8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  aiRecText: {
    color: '#E8EAED',
    fontSize: 11,
    lineHeight: 16,
  },
  sectionHeaderTitle: {
    color: '#9AA0A6',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  altRouteFuel: {
    color: '#FBBC04',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  locationSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#303134',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  locationSummaryLabel: {
    color: '#9AA0A6',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
  },
  locationRefreshButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(26, 115, 232, 0.15)',
  },
  shortcutIconBg: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(26, 115, 232, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutName: {
    color: '#E8EAED',
    fontSize: 13,
    fontWeight: '600',
  },
  shortcutAddr: {
    color: '#9AA0A6',
    fontSize: 11,
    marginTop: 1,
  },
});
