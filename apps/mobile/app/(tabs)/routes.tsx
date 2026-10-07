import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Dimensions,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus,
  Sparkles,
  Zap,
  Lock,
  Unlock,
  Navigation,
  CheckCircle2,
  Clock,
  Fuel,
  IndianRupee,
  MapPin,
  Trash2,
  Search,
  X,
  Compass,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Crosshair,
  Package,
  Flag,
  RotateCcw,
  Target,
  Maximize2,
  Minimize2,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import { THEME } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { MapViewAbstraction } from '@/components/map/MapViewAbstraction';
import { OptimizationSelector } from '@/components/route/OptimizationSelector';
import { IRSScoreBreakdown } from '@/components/route/IRSScoreBreakdown';
import { useMultiStopStore } from '@/stores/useMultiStopStore';
import { useVehicleStore } from '@/stores/useVehicleStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { useNavigationStore } from '@/stores/useNavigationStore';
import { geocodingService } from '@/services/api/geocoding';
import { StopItem, GeoPoint, VehicleType } from '@/types';

export default function RoutesScreen() {
  const router = useRouter();
  const {
    origin,
    destination,
    stops,
    setOrigin,
    setDestination,
    addStop,
    removeStop,
    toggleStopLock,
    optimizationMode,
    setOptimizationMode,
    calculateMultiStopTour,
    getSelectedRoute,
    metadata,
    isLoading,
  } = useMultiStopStore();

  const { getSelectedVehicle, selectVehicle, vehicles } = useVehicleStore();
  const { currentLocation, updateCoordinates } = useLocationStore();
  const { startNavigation } = useNavigationStore();

  // 1. Start Point State (Live GPS vs Custom Hub)
  const [startPointMode, setStartPointMode] = useState<'LIVE' | 'CUSTOM'>('LIVE');
  const [startSearchQuery, setStartSearchQuery] = useState('');
  const [startSearchResults, setStartSearchResults] = useState<GeoPoint[]>([]);
  const [isSearchingStart, setIsSearchingStart] = useState(false);

  // 2. Middle Drops State
  const [middleSearchQuery, setMiddleSearchQuery] = useState('');
  const [middleSearchResults, setMiddleSearchResults] = useState<GeoPoint[]>([]);
  const [isSearchingMiddle, setIsSearchingMiddle] = useState(false);
  const [newStopPriority, setNewStopPriority] = useState<number>(1); // 1: Normal, 2: High, 3: Urgent

  // 3. End Point State (Last Drop vs Return to Start vs Custom Hub)
  const [endPointMode, setEndPointMode] = useState<'LAST_DROP' | 'RETURN_START' | 'CUSTOM'>('LAST_DROP');
  const [endSearchQuery, setEndSearchQuery] = useState('');
  const [endSearchResults, setEndSearchResults] = useState<GeoPoint[]>([]);
  const [isSearchingEnd, setIsSearchingEnd] = useState(false);
  const [customEndLocation, setCustomEndLocation] = useState<GeoPoint | null>(null);

  // Map controls & Point Inspection State
  const [isFullScreenMap, setIsFullScreenMap] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [isScrollEnabled, setIsScrollEnabled] = useState(true);
  const [focusedLocation, setFocusedLocation] = useState<{ latitude: number; longitude: number; zoom?: number } | null>(null);
  const [focusedPointLabel, setFocusedPointLabel] = useState<string | null>(null);
  const [activeStopIndex, setActiveStopIndex] = useState<number | null>(null);

  const selectedVehicle = getSelectedVehicle();
  const selectedRoute = getSelectedRoute();
  const searchTimeoutRef = useRef<any>(null);

  // Multi-Stop keeps its own local map controls and end-point draft.

  const handleFocusPoint = (lat: number, lng: number, label: string, index?: number) => {
    setFocusedLocation({ latitude: lat, longitude: lng, zoom: 17 });
    setFocusedPointLabel(label);
    if (typeof index === 'number') {
      setActiveStopIndex(index);
    } else {
      setActiveStopIndex(null);
    }
  };

  const handleFitAllStops = () => {
    setFocusedLocation(null);
    setFocusedPointLabel(null);
    setActiveStopIndex(null);
  };

  // Vehicle selector options
  const vehicleOptions: { type: VehicleType; label: string; icon: string }[] = [
    { type: 'BIKE', label: 'Bike', icon: '🏍️' },
    { type: 'CAR', label: 'Car', icon: '🚗' },
    { type: 'TRUCK', label: 'Truck', icon: '🚚' },
    { type: 'BUS', label: 'Bus', icon: '🚌' },
    { type: 'EV', label: 'EV', icon: '⚡' },
  ];

  const handleSelectVehicleType = (vType: VehicleType) => {
    const match = vehicles.find((v) => v.vehicle_type === vType);
    if (match) {
      selectVehicle(match.id);
    }
    if (selectedRoute) {
      handleCalculateRoute(vType);
    }
  };

  // --- Auto-detect live location for Start Point on Mount ---
  const handleSetLiveLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const fresh = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        updateCoordinates(
          fresh.coords.latitude,
          fresh.coords.longitude,
          fresh.coords.speed ? fresh.coords.speed * 3.6 : 0,
          fresh.coords.heading,
          fresh.coords.accuracy,
          fresh.coords.altitude
        );

        try {
          const rev = await geocodingService.reverse(fresh.coords.latitude, fresh.coords.longitude);
          setOrigin({
            lat: fresh.coords.latitude,
            lng: fresh.coords.longitude,
            name: rev?.name || 'Live GPS Location',
            address: rev?.address || `${fresh.coords.latitude.toFixed(4)}, ${fresh.coords.longitude.toFixed(4)}`,
            city: rev?.city || '',
          });
        } catch {
          setOrigin({
            lat: fresh.coords.latitude,
            lng: fresh.coords.longitude,
            name: 'Live GPS Location',
            address: `${fresh.coords.latitude.toFixed(4)}, ${fresh.coords.longitude.toFixed(4)}`,
          });
        }
      }
    } catch {
      // Handled
    }
  };

  // --- Start Point Search Handlers ---
  const handleStartSearch = (text: string) => {
    setStartSearchQuery(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (text.trim().length >= 1) {
      setIsSearchingStart(true);
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const results = await geocodingService.search(text, origin ? { lat: origin.lat, lng: origin.lng } : undefined);
          setStartSearchResults(results);
        } catch {
          setStartSearchResults([]);
        } finally {
          setIsSearchingStart(false);
        }
      }, 75);
    } else {
      setStartSearchResults([]);
      setIsSearchingStart(false);
    }
  };

  const handleSelectStartPlace = (place: GeoPoint) => {
    setOrigin(place);
    setStartSearchQuery('');
    setStartSearchResults([]);
    setIsSearchingStart(false);
    handleFocusPoint(place.lat, place.lng, `Start: ${place.name || place.address}`);
  };

  // --- Middle Drops Search & Add Handlers ---
  const handleMiddleSearch = (text: string) => {
    setMiddleSearchQuery(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (text.trim().length >= 1) {
      setIsSearchingMiddle(true);
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const results = await geocodingService.search(text, origin ? { lat: origin.lat, lng: origin.lng } : undefined);
          setMiddleSearchResults(results);
        } catch {
          setMiddleSearchResults([]);
        } finally {
          setIsSearchingMiddle(false);
        }
      }, 75);
    } else {
      setMiddleSearchResults([]);
      setIsSearchingMiddle(false);
    }
  };

  const handleAddMiddleStop = (place?: GeoPoint) => {
    if (place) {
      const newStop: StopItem = {
        id: `stop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: place.name || 'Delivery Drop',
        address: place.address || `${place.lat.toFixed(4)}, ${place.lng.toFixed(4)}`,
        lat: place.lat,
        lng: place.lng,
        priority: newStopPriority,
        time_window_start: '10:00',
        time_window_end: '18:00',
        is_locked: false,
        status: 'PENDING',
      };
      addStop(newStop);
      setMiddleSearchQuery('');
      setMiddleSearchResults([]);
      setIsSearchingMiddle(false);
      handleFocusPoint(newStop.lat, newStop.lng, `Drop: ${newStop.name}`, stops.length);
    } else if (middleSearchQuery.trim().length > 0) {
      // Add first result or geocode on the fly
      if (middleSearchResults.length > 0) {
        handleAddMiddleStop(middleSearchResults[0]);
      }
    }
  };

  // --- End Point Search Handlers ---
  const handleEndSearch = (text: string) => {
    setEndSearchQuery(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (text.trim().length >= 1) {
      setIsSearchingEnd(true);
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const results = await geocodingService.search(text, origin ? { lat: origin.lat, lng: origin.lng } : undefined);
          setEndSearchResults(results);
        } catch {
          setEndSearchResults([]);
        } finally {
          setIsSearchingEnd(false);
        }
      }, 75);
    } else {
      setEndSearchResults([]);
      setIsSearchingEnd(false);
    }
  };

  const handleSelectEndPlace = (place: GeoPoint) => {
    setCustomEndLocation(place);
    setDestination(place);
    setEndSearchQuery('');
    setEndSearchResults([]);
    setIsSearchingEnd(false);
    handleFocusPoint(place.lat, place.lng, `End: ${place.name || place.address}`);
  };

  // Map tap handler: adds to middle drops by default
  const handleMapPress = async (coords: { latitude: number; longitude: number }) => {
    try {
      const rev = await geocodingService.reverse(coords.latitude, coords.longitude);
      const place: GeoPoint = {
        lat: coords.latitude,
        lng: coords.longitude,
        name: rev?.name || `Drop (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`,
        address: rev?.address || `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`,
      };
      handleAddMiddleStop(place);
    } catch {
      handleAddMiddleStop({
        lat: coords.latitude,
        lng: coords.longitude,
        name: `Drop (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`,
        address: `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`,
      });
    }
  };

  // --- Calculate Route Model Trigger ---
  const handleCalculateRoute = async (vType?: VehicleType) => {
    const activeVType = vType || selectedVehicle.vehicle_type;

    if (stops.length === 0) {
      handleFitAllStops();
      return;
    }

    // Adjust destination based on end point mode:
    if (endPointMode === 'RETURN_START' && origin) {
      setDestination(origin);
    } else if (endPointMode === 'CUSTOM' && customEndLocation) {
      setDestination(customEndLocation);
    }

    await calculateMultiStopTour(activeVType);
    handleFitAllStops();
  };

  const handleStartNav = () => {
    if (selectedRoute) {
      startNavigation(
        selectedRoute.steps,
        selectedRoute.distance_km,
        selectedRoute.duration_min,
        selectedRoute.coordinates,
        {
          route: selectedRoute,
          origin,
          destination,
          waypoints: useMultiStopStore.getState().waypoints,
          metadata,
        }
      );
      router.push({
        pathname: '/navigation/[routeId]',
        params: { routeId: selectedRoute.id },
      });
    }
  };



  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        title="Multi-Stop Journey Planner"
        subtitle="Start → Middle Drops (Nearest First) → End Point"
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={isScrollEnabled}
      >
        {/* Top Header Card */}
        <View style={styles.topHeaderCard}>
          <View style={styles.topHeaderLeft}>
            <View style={styles.plannerIconWrap}>
              <Package size={20} color="#1A73E8" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.plannerTitle}>Multi-Stop Journey Planner</Text>
              <Text style={styles.plannerSub}>Start → Middle Drops (Nearest First) → End Point</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.headerCalculateBtn}
            onPress={() => handleCalculateRoute()}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Sparkles size={15} color="#FFFFFF" />
                <Text style={styles.headerCalculateText}>Calculate</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* 1. SECTION 1: START POINT (DEPARTURE HUB) */}
        <View style={styles.sectionCardGreen}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.badgeWithLabel}>
              <View style={styles.badgeA}>
                <Text style={styles.badgeLetter}>A</Text>
              </View>
              <Text style={styles.sectionTitleGreen}>1. START POINT (DEPARTURE HUB)</Text>
            </View>

            <TouchableOpacity style={styles.liveLocationBtn} onPress={handleSetLiveLocation}>
              <Crosshair size={14} color="#34A853" />
              <Text style={styles.liveLocationBtnText}>Set Live Location</Text>
            </TouchableOpacity>
          </View>

          {/* Mode Selector Tabs */}
          <View style={styles.tabToggleRow}>
            <TouchableOpacity
              style={[styles.tabToggle, startPointMode === 'LIVE' && styles.tabToggleActiveGreen]}
              onPress={() => setStartPointMode('LIVE')}
            >
              <Text style={styles.tabEmoji}>📍</Text>
              <View>
                <Text style={[styles.tabTitle, startPointMode === 'LIVE' && styles.tabTitleActiveGreen]}>
                  Live GPS Location
                </Text>
                <Text style={styles.tabDesc}>Start from your current device</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabToggle, startPointMode === 'CUSTOM' && styles.tabToggleActiveGreen]}
              onPress={() => setStartPointMode('CUSTOM')}
            >
              <Text style={styles.tabEmoji}>🔍</Text>
              <View>
                <Text style={[styles.tabTitle, startPointMode === 'CUSTOM' && styles.tabTitleActiveGreen]}>
                  Custom Hub / Search
                </Text>
                <Text style={styles.tabDesc}>Choose warehouse or depot</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* If Custom Hub: Search Bar */}
          {startPointMode === 'CUSTOM' && (
            <View style={styles.innerSearchBox}>
              <View style={styles.searchPill}>
                <Search size={16} color="#8AB4F8" style={{ marginLeft: 10 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search Google Maps location for start depot..."
                  placeholderTextColor="#9AA0A6"
                  value={startSearchQuery}
                  onChangeText={handleStartSearch}
                />
                {startSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setStartSearchQuery('')} style={{ padding: 6 }}>
                    <X size={15} color="#BDC1C6" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Autocomplete Dropdown */}
              {(startSearchResults.length > 0 || isSearchingStart) && (
                <View style={styles.autocompleteCard}>
                  {isSearchingStart && (
                    <View style={styles.searchingRow}>
                      <ActivityIndicator size="small" color="#8AB4F8" />
                      <Text style={styles.searchingText}>Searching Google Maps locations...</Text>
                    </View>
                  )}
                  {startSearchResults.map((place, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.autocompleteItem}
                      onPress={() => handleSelectStartPlace(place)}
                    >
                      <MapPin size={15} color="#34A853" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.autocompleteName} numberOfLines={1}>{place.name}</Text>
                        <Text style={styles.autocompleteAddr} numberOfLines={1}>{place.address}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Selected Location Card Display */}
          <TouchableOpacity
            style={styles.selectedLocCardGreen}
            activeOpacity={0.7}
            onPress={() => {
              if (origin?.lat && origin?.lng) {
                handleFocusPoint(origin.lat, origin.lng, `Start Hub: ${origin.name || origin.address}`);
              }
            }}
          >
            <View style={styles.locDotGreen} />
            <View style={{ flex: 1 }}>
              <Text style={styles.locNameText} numberOfLines={1}>
                {origin?.name || origin?.address || 'No start location selected'}
              </Text>
              <Text style={styles.locGpsText}>
                {origin?.lat ? `GPS: ${origin.lat.toFixed(4)}, ${origin.lng.toFixed(4)}` : 'Choose Live GPS or search for a start location'}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 6 }}>
              {origin?.lat && (
                <TouchableOpacity
                  style={styles.focusOnMapBtn}
                  onPress={() => handleFocusPoint(origin.lat, origin.lng, `Start: ${origin.name || origin.address}`)}
                >
                  <Crosshair size={13} color="#34A853" />
                  <Text style={styles.focusOnMapText}>Inspect</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.refreshBtn} onPress={handleSetLiveLocation}>
                <RefreshCw size={13} color="#34A853" />
                <Text style={styles.refreshBtnText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </View>

        {/* 2. SECTION 2: MIDDLE DROPS (AUTO-SORTED NEAREST FIRST) */}
        <View style={styles.sectionCardBlue}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.badgeWithLabel}>
              <View style={styles.badgeBlue}>
                <Text style={styles.badgeLetter}>{stops.length}</Text>
              </View>
              <Text style={styles.sectionTitleBlue}>2. MIDDLE DROPS ({stops.length})</Text>
            </View>
            <Text style={styles.sectionSubBlue}>Auto-sorted Nearest First</Text>
          </View>

          {/* Quick Add Row: Address Search + Priority + Add Button */}
          <View style={styles.quickAddRow}>
            <View style={[styles.searchPill, { flex: 1 }]}>
              <TextInput
                style={styles.searchInput}
                placeholder="Type address or click on map..."
                placeholderTextColor="#9AA0A6"
                value={middleSearchQuery}
                onChangeText={handleMiddleSearch}
              />
              {middleSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setMiddleSearchQuery('')} style={{ padding: 6 }}>
                  <X size={14} color="#BDC1C6" />
                </TouchableOpacity>
              )}
            </View>

            {/* Priority Selector */}
            <TouchableOpacity
              style={styles.prioritySelectBtn}
              onPress={() => setNewStopPriority(newStopPriority === 3 ? 1 : newStopPriority + 1)}
            >
              <Text style={styles.prioritySelectText}>
                {newStopPriority === 3 ? 'Urgent' : newStopPriority === 2 ? 'High' : 'Normal'}
              </Text>
            </TouchableOpacity>

            {/* Add Button */}
            <TouchableOpacity style={styles.addStopBtn} onPress={() => handleAddMiddleStop()}>
              <Plus size={16} color="#FFFFFF" />
              <Text style={styles.addStopBtnText}>Add</Text>
            </TouchableOpacity>
          </View>

          {/* Autocomplete Dropdown for Middle Drops */}
          {(middleSearchResults.length > 0 || isSearchingMiddle) && (
            <View style={styles.autocompleteCard}>
              {isSearchingMiddle && (
                <View style={styles.searchingRow}>
                  <ActivityIndicator size="small" color="#8AB4F8" />
                  <Text style={styles.searchingText}>Searching Google Maps locations...</Text>
                </View>
              )}
              {middleSearchResults.map((place, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.autocompleteItem}
                  onPress={() => handleAddMiddleStop(place)}
                >
                  <MapPin size={15} color="#1A73E8" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.autocompleteName} numberOfLines={1}>{place.name}</Text>
                    <Text style={styles.autocompleteAddr} numberOfLines={1}>{place.address}</Text>
                  </View>
                  <Plus size={15} color="#34A853" />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* List of Added Stops */}
          {stops.length > 0 ? (
            <View style={{ marginTop: 10, gap: 8 }}>
              {stops.map((stop, idx) => {
                const isLocked = stop.is_locked;
                const isSelected = activeStopIndex === idx;
                return (
                  <TouchableOpacity
                    key={stop.id || idx}
                    style={[styles.middleStopItem, isSelected && styles.middleStopItemSelected]}
                    activeOpacity={0.8}
                    onPress={() => handleFocusPoint(stop.lat, stop.lng, `Drop #${idx + 1}: ${stop.name || stop.address}`, idx)}
                  >
                    <View style={styles.stopNumCircle}>
                      <Text style={styles.stopNumText}>{idx + 1}</Text>
                    </View>

                    <View style={{ flex: 1, paddingHorizontal: 8 }}>
                      <Text style={styles.middleStopName} numberOfLines={1}>
                        {stop.name || `Drop ${idx + 1}`}
                      </Text>
                      <Text style={styles.middleStopAddr} numberOfLines={1}>
                        {stop.address}
                      </Text>
                      <View style={styles.middleStopMeta}>
                        <Text style={[
                          styles.metaPriority,
                          stop.priority === 3 ? styles.metaUrgent : stop.priority === 2 ? styles.metaHigh : styles.metaNormal
                        ]}>
                          {stop.priority === 3 ? 'Urgent' : stop.priority === 2 ? 'High' : 'Normal'}
                        </Text>
                        <Text style={styles.inspectHint}>• Tap to inspect on map</Text>
                      </View>
                    </View>

                    <View style={styles.stopActionRow}>
                      <TouchableOpacity
                        onPress={() => handleFocusPoint(stop.lat, stop.lng, `Drop #${idx + 1}: ${stop.name || stop.address}`, idx)}
                        style={styles.stopActionBtn}
                      >
                        <Crosshair size={14} color="#8AB4F8" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => toggleStopLock(stop.id)}
                        style={[styles.stopActionBtn, isLocked && styles.stopActionBtnLocked]}
                      >
                        {isLocked ? <Lock size={14} color="#FBBC04" /> : <Unlock size={14} color="#9AA0A6" />}
                      </TouchableOpacity>

                      <TouchableOpacity onPress={() => removeStop(stop.id)} style={styles.stopActionBtn}>
                        <Trash2 size={14} color="#EA4335" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyStopsBox}>
              <Text style={styles.emptyStopsText}>No middle drops added yet. Type above or tap the map.</Text>
            </View>
          )}
        </View>

        {/* 3. SECTION 3: END POINT (FINISH LOCATION) */}
        <View style={styles.sectionCardRed}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.badgeWithLabel}>
              <View style={styles.badgeRed}>
                <Text style={styles.badgeLetter}>B</Text>
              </View>
              <Text style={styles.sectionTitleRed}>3. END POINT (FINISH LOCATION)</Text>
            </View>
          </View>

          {/* 3 Finish Options */}
          <View style={styles.finishOptionsRow}>
            <TouchableOpacity
              style={[styles.finishOptionCard, endPointMode === 'LAST_DROP' && styles.finishOptionCardActiveRed]}
              onPress={() => setEndPointMode('LAST_DROP')}
            >
              <Text style={styles.tabEmoji}>🏁</Text>
              <Text style={[styles.finishOptionTitle, endPointMode === 'LAST_DROP' && styles.finishOptionTitleActiveRed]}>
                Last Drop
              </Text>
              <Text style={styles.finishOptionSub}>Finish at final customer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.finishOptionCard, endPointMode === 'RETURN_START' && styles.finishOptionCardActiveRed]}
              onPress={() => setEndPointMode('RETURN_START')}
            >
              <Text style={styles.tabEmoji}>🔄</Text>
              <Text style={[styles.finishOptionTitle, endPointMode === 'RETURN_START' && styles.finishOptionTitleActiveRed]}>
                Return to Start
              </Text>
              <Text style={styles.finishOptionSub}>Round-trip back to depot</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.finishOptionCard, endPointMode === 'CUSTOM' && styles.finishOptionCardActiveRed]}
              onPress={() => setEndPointMode('CUSTOM')}
            >
              <Text style={styles.tabEmoji}>🎯</Text>
              <Text style={[styles.finishOptionTitle, endPointMode === 'CUSTOM' && styles.finishOptionTitleActiveRed]}>
                Custom Hub
              </Text>
              <Text style={styles.finishOptionSub}>Specific finish address</Text>
            </TouchableOpacity>
          </View>

          {/* If Custom Finish Hub: Search Bar */}
          {endPointMode === 'CUSTOM' && (
            <View style={styles.innerSearchBox}>
              <View style={styles.searchPill}>
                <Search size={16} color="#8AB4F8" style={{ marginLeft: 10 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search Google Maps location for destination..."
                  placeholderTextColor="#9AA0A6"
                  value={endSearchQuery}
                  onChangeText={handleEndSearch}
                />
                {endSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setEndSearchQuery('')} style={{ padding: 6 }}>
                    <X size={15} color="#BDC1C6" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Autocomplete Dropdown */}
              {(endSearchResults.length > 0 || isSearchingEnd) && (
                <View style={styles.autocompleteCard}>
                  {isSearchingEnd && (
                    <View style={styles.searchingRow}>
                      <ActivityIndicator size="small" color="#8AB4F8" />
                      <Text style={styles.searchingText}>Searching Google Maps locations...</Text>
                    </View>
                  )}
                  {endSearchResults.map((place, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.autocompleteItem}
                      onPress={() => handleSelectEndPlace(place)}
                    >
                      <MapPin size={15} color="#EA4335" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.autocompleteName} numberOfLines={1}>{place.name}</Text>
                        <Text style={styles.autocompleteAddr} numberOfLines={1}>{place.address}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {customEndLocation && (
                <TouchableOpacity
                  style={styles.selectedLocCardRed}
                  activeOpacity={0.7}
                  onPress={() => handleFocusPoint(customEndLocation.lat, customEndLocation.lng, `Destination: ${customEndLocation.name || customEndLocation.address}`)}
                >
                  <View style={styles.locDotRed} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.locNameText} numberOfLines={1}>{customEndLocation.name}</Text>
                    <Text style={styles.locGpsText}>{customEndLocation.address}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.focusOnMapBtnRed}
                    onPress={() => handleFocusPoint(customEndLocation.lat, customEndLocation.lng, `Destination: ${customEndLocation.name || customEndLocation.address}`)}
                  >
                    <Crosshair size={13} color="#EA4335" />
                    <Text style={styles.focusOnMapTextRed}>Inspect</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* 4. Vehicle Selection Pills */}
        <View style={styles.vehicleSection}>
          <Text style={styles.sectionHeaderLabel}>Fleet Vehicle Configuration:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
            {vehicleOptions.map((vOpt) => {
              const isSelected = selectedVehicle.vehicle_type === vOpt.type;
              return (
                <TouchableOpacity
                  key={vOpt.type}
                  style={[styles.vehPill, isSelected && styles.vehPillActive]}
                  onPress={() => handleSelectVehicleType(vOpt.type)}
                >
                  <Text style={{ fontSize: 13 }}>{vOpt.icon}</Text>
                  <Text style={[styles.vehPillText, isSelected && styles.vehPillTextActive]}>
                    {vOpt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* 5. Interactive Google Map Preview with Smooth Touch & Point Inspection */}
        <View
          style={[styles.mapCard, isMapExpanded && styles.mapCardExpanded]}
          onTouchStart={() => setIsScrollEnabled(false)}
          onTouchEnd={() => setIsScrollEnabled(true)}
          onTouchCancel={() => setIsScrollEnabled(true)}
        >
          <MapViewAbstraction
            origin={origin}
            destination={destination}
            stops={stops}
            activeRoute={selectedRoute}
            focusedLocation={focusedLocation}
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
            showControls
            style={styles.mapCanvas}
          />

          {/* Top Floating Map Controls & Inspection Status */}
          <View style={styles.mapOverlayHeader}>
            <View style={styles.mapBadge}>
              <MapPin size={13} color="#8AB4F8" />
              <Text style={styles.mapBadgeText}>
                {stops.length + (origin ? 1 : 0) + (destination ? 1 : 0)} Waypoints • Drag/Pinch to move
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity
                style={styles.mapFullScreenBtn}
                onPress={() => setIsFullScreenMap(true)}
              >
                <Maximize2 size={13} color="#8AB4F8" />
                <Text style={styles.mapFitAllBtnText}>Full Screen</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.mapFitAllBtn}
                onPress={handleFitAllStops}
              >
                <Compass size={13} color="#8AB4F8" />
                <Text style={styles.mapFitAllBtnText}>Fit All</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.mapExpandToggle}
                onPress={() => setIsMapExpanded(!isMapExpanded)}
              >
                {isMapExpanded ? <ChevronUp size={16} color="#FFFFFF" /> : <ChevronDown size={16} color="#FFFFFF" />}
              </TouchableOpacity>
            </View>
          </View>

          {/* Focused Stop Floating Toast Banner */}
          {focusedPointLabel && (
            <View style={styles.mapFocusBanner}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Target size={14} color="#8AB4F8" />
                <Text style={styles.mapFocusBannerText} numberOfLines={1}>
                  {focusedPointLabel}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.mapFocusDismissBtn}
                onPress={handleFitAllStops}
              >
                <Text style={styles.mapFocusDismissText}>Show All</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 6. Big Action CTA Button */}
        <TouchableOpacity
          style={styles.bigCalculateBtn}
          onPress={() => handleCalculateRoute()}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Sparkles size={20} color="#FFFFFF" />
              <Text style={styles.bigCalculateBtnText}>
                Optimize & Calculate Route ({stops.length} Drops)
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* 7. Route Summary Card (If Route Calculated) */}
        {selectedRoute && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View>
                <Text style={styles.summaryTitle}>Multi-Stop Tour Optimized</Text>
                <Text style={styles.summarySub}>
                  Vehicle: <Text style={{ color: '#8AB4F8' }}>{selectedVehicle.name}</Text> • 2-Opt Algorithm Verified
                </Text>
              </View>
              <View style={styles.scoreBadge}>
                <Sparkles size={14} color="#34A853" />
                <Text style={styles.scoreBadgeText}>{Math.round(selectedRoute.overall_score || 95)}/100</Text>
              </View>
            </View>

            {/* 4-Pill Objective Metrics */}
            <View style={styles.metricsGrid}>
              <View style={styles.metricItem}>
                <Clock size={15} color="#8AB4F8" />
                <Text style={styles.metricLabel}>Total Time</Text>
                <Text style={styles.metricValue}>{Math.round(selectedRoute.duration_min)} min</Text>
              </View>

              <View style={styles.metricItem}>
                <Fuel size={15} color="#FBBC04" />
                <Text style={styles.metricLabel}>Fuel / EV</Text>
                <Text style={styles.metricValue}>
                  {selectedVehicle.vehicle_type === 'EV'
                    ? `${((selectedRoute.fuel_litres || 1.4) * 2.8).toFixed(1)} kWh`
                    : `${selectedRoute.fuel_litres || 1.4} L`}
                </Text>
              </View>

              <View style={styles.metricItem}>
                <IndianRupee size={15} color="#34A853" />
                <Text style={styles.metricLabel}>Total Cost</Text>
                <Text style={styles.metricValue}>
                  ₹{Math.round(selectedRoute.total_cost_inr || selectedRoute.fuel_cost_inr || 150)}
                </Text>
              </View>

              <View style={styles.metricItem}>
                <Compass size={15} color="#8AB4F8" />
                <Text style={styles.metricLabel}>Distance</Text>
                <Text style={styles.metricValue}>{selectedRoute.distance_km} km</Text>
              </View>
            </View>

            {/* Recommendation Reason */}
            {selectedRoute.recommendation_reason && (
              <View style={styles.aiReasonBox}>
                <Text style={styles.aiReasonText}>💡 {selectedRoute.recommendation_reason}</Text>
              </View>
            )}

            {/* Optimal Stop Sequence Itinerary Breakdown */}
            <View style={styles.itinerarySection}>
              <Text style={styles.itineraryTitle}>Optimized Tour Itinerary (Tap to verify point on map):</Text>

              {/* Start Hub Item */}
              {origin && (
                <TouchableOpacity
                  style={styles.itineraryItem}
                  onPress={() => handleFocusPoint(origin.lat, origin.lng, `Start Hub: ${origin.name || origin.address}`)}
                >
                  <View style={styles.itineraryPinA}>
                    <Text style={styles.itineraryPinText}>A</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itineraryItemName} numberOfLines={1}>
                      Start: {origin.name || 'Departure Hub'}
                    </Text>
                    <Text style={styles.itineraryItemAddr} numberOfLines={1}>
                      {origin.address}
                    </Text>
                  </View>
                  <Crosshair size={14} color="#34A853" />
                </TouchableOpacity>
              )}

              {/* Ordered Intermediate Drops */}
              {stops.map((stop, idx) => (
                <TouchableOpacity
                  key={stop.id || idx}
                  style={styles.itineraryItem}
                  onPress={() => handleFocusPoint(stop.lat, stop.lng, `Stop #${idx + 1}: ${stop.name || stop.address}`, idx)}
                >
                  <View style={styles.itineraryPinDrop}>
                    <Text style={styles.itineraryPinText}>{idx + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itineraryItemName} numberOfLines={1}>
                      {idx + 1}. {stop.name || `Drop ${idx + 1}`}
                    </Text>
                    <Text style={styles.itineraryItemAddr} numberOfLines={1}>
                      {stop.address}
                    </Text>
                  </View>
                  <Crosshair size={14} color="#8AB4F8" />
                </TouchableOpacity>
              ))}

              {/* Finish Destination Item */}
              {destination && (
                <TouchableOpacity
                  style={styles.itineraryItem}
                  onPress={() => handleFocusPoint(destination.lat, destination.lng, `Finish: ${destination.name || destination.address}`)}
                >
                  <View style={styles.itineraryPinB}>
                    <Text style={styles.itineraryPinText}>B</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itineraryItemName} numberOfLines={1}>
                      Finish: {destination.name || 'End Point'}
                    </Text>
                    <Text style={styles.itineraryItemAddr} numberOfLines={1}>
                      {destination.address}
                    </Text>
                  </View>
                  <Crosshair size={14} color="#EA4335" />
                </TouchableOpacity>
              )}
            </View>

            {/* Start Navigation CTA */}
            <TouchableOpacity style={styles.startNavBtn} onPress={handleStartNav} activeOpacity={0.8}>
              <Navigation size={18} color="#FFFFFF" />
              <Text style={styles.startNavBtnText}>
                Start Multi-Stop Navigation ({Math.round(selectedRoute.duration_min)} min)
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* 8. Full-Screen Interactive Exploration Map Modal */}
      <Modal
        visible={isFullScreenMap}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setIsFullScreenMap(false)}
      >
        <SafeAreaView style={styles.fullScreenModalContainer} edges={['top', 'bottom']}>
          {/* Full-bleed Canvas */}
          <MapViewAbstraction
            origin={origin}
            destination={destination}
            stops={stops}
            activeRoute={selectedRoute}
            focusedLocation={focusedLocation}
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
            showControls
            style={styles.fullScreenCanvas}
          />

          {/* Floating Top Header Bar */}
          <View style={styles.fsTopBar}>
            <TouchableOpacity
              style={styles.fsCloseBtn}
              onPress={() => setIsFullScreenMap(false)}
            >
              <X size={18} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.fsTitleWrap}>
              <Text style={styles.fsTitleText}>Full Screen Map</Text>
              <Text style={styles.fsSubText}>
                {stops.length + (origin ? 1 : 0) + (destination ? 1 : 0)} Waypoints • Drag & Explore
              </Text>
            </View>

            <TouchableOpacity
              style={styles.fsActionBtn}
              onPress={handleFitAllStops}
            >
              <Compass size={16} color="#8AB4F8" />
            </TouchableOpacity>
          </View>

          {/* Floating Bottom Horizontal Stops Carousel */}
          <View style={styles.fsBottomTray}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.fsStopsCarousel}
            >
              {/* Origin Point A */}
              {origin && (
                <TouchableOpacity
                  style={[
                    styles.fsStopCard,
                    activeStopIndex === null && focusedLocation?.latitude === origin.lat && styles.fsStopCardActive,
                  ]}
                  onPress={() => handleFocusPoint(origin.lat, origin.lng, `Start Hub: ${origin.name || origin.address}`)}
                >
                  <View style={styles.itineraryPinA}>
                    <Text style={styles.itineraryPinText}>A</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fsStopCardName} numberOfLines={1}>
                      Start: {origin.name || 'Departure Hub'}
                    </Text>
                    <Text style={styles.fsStopCardAddr} numberOfLines={1}>
                      {origin.address}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}

              {/* Middle Drops */}
              {stops.map((stop, idx) => {
                const isSelected = activeStopIndex === idx;
                return (
                  <TouchableOpacity
                    key={stop.id || idx}
                    style={[styles.fsStopCard, isSelected && styles.fsStopCardActive]}
                    onPress={() => handleFocusPoint(stop.lat, stop.lng, `Drop #${idx + 1}: ${stop.name || stop.address}`, idx)}
                  >
                    <View style={styles.itineraryPinDrop}>
                      <Text style={styles.itineraryPinText}>{idx + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fsStopCardName} numberOfLines={1}>
                        {idx + 1}. {stop.name || `Drop ${idx + 1}`}
                      </Text>
                      <Text style={styles.fsStopCardAddr} numberOfLines={1}>
                        {stop.address}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* Destination Point B */}
              {destination && (
                <TouchableOpacity
                  style={[
                    styles.fsStopCard,
                    focusedLocation?.latitude === destination.lat && styles.fsStopCardActive,
                  ]}
                  onPress={() => handleFocusPoint(destination.lat, destination.lng, `Finish: ${destination.name || destination.address}`)}
                >
                  <View style={styles.itineraryPinB}>
                    <Text style={styles.itineraryPinText}>B</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fsStopCardName} numberOfLines={1}>
                      Finish: {destination.name || 'End Point'}
                    </Text>
                    <Text style={styles.fsStopCardAddr} numberOfLines={1}>
                      {destination.address}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            </ScrollView>

            {/* If route calculated, show quick nav bar */}
            {selectedRoute && (
              <View style={styles.fsBottomNavRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fsNavMetric}>
                    {selectedRoute.distance_km} km • {Math.round(selectedRoute.duration_min)} min
                  </Text>
                  <Text style={styles.fsNavSub}>
                    ₹{Math.round(selectedRoute.total_cost_inr || 150)} • {selectedVehicle.name}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.fsNavBtn}
                  onPress={() => {
                    setIsFullScreenMap(false);
                    handleStartNav();
                  }}
                >
                  <Navigation size={15} color="#FFFFFF" />
                  <Text style={styles.fsNavBtnText}>Navigate</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#202124',
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 40,
  },
  topHeaderCard: {
    backgroundColor: '#303134',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  topHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  plannerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(26, 115, 232, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plannerTitle: {
    color: '#E8EAED',
    fontSize: 14,
    fontWeight: '700',
  },
  plannerSub: {
    color: '#9AA0A6',
    fontSize: 10,
    marginTop: 2,
  },

  headerCalculateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1A73E8',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  headerCalculateText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionCardGreen: {
    backgroundColor: '#303134',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(52, 168, 83, 0.4)',
    marginBottom: 12,
  },
  sectionCardBlue: {
    backgroundColor: '#303134',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(26, 115, 232, 0.4)',
    marginBottom: 12,
  },
  sectionCardRed: {
    backgroundColor: '#303134',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(234, 67, 53, 0.4)',
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  badgeWithLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badgeA: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#34A853',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeBlue: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1A73E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRed: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EA4335',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLetter: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  sectionTitleGreen: {
    color: '#E8EAED',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sectionTitleBlue: {
    color: '#E8EAED',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sectionTitleRed: {
    color: '#E8EAED',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sectionSubBlue: {
    color: '#9AA0A6',
    fontSize: 11,
    fontWeight: '500',
  },
  liveLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(52, 168, 83, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 168, 83, 0.3)',
  },
  liveLocationBtnText: {
    color: '#34A853',
    fontSize: 11,
    fontWeight: '600',
  },
  tabToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  tabToggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#202124',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabToggleActiveGreen: {
    borderColor: '#34A853',
    backgroundColor: 'rgba(52, 168, 83, 0.12)',
  },
  tabEmoji: {
    fontSize: 16,
  },
  tabTitle: {
    color: '#BDC1C6',
    fontSize: 11,
    fontWeight: '700',
  },
  tabTitleActiveGreen: {
    color: '#34A853',
  },
  tabDesc: {
    color: '#9AA0A6',
    fontSize: 9,
    marginTop: 1,
  },
  selectedLocCardGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#202124',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(52, 168, 83, 0.3)',
    gap: 10,
  },
  selectedLocCardRed: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#202124',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(234, 67, 53, 0.3)',
    gap: 10,
    marginTop: 8,
  },
  locDotGreen: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#34A853',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  locDotRed: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EA4335',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  locNameText: {
    color: '#E8EAED',
    fontSize: 13,
    fontWeight: '600',
  },
  locGpsText: {
    color: '#9AA0A6',
    fontSize: 10,
    marginTop: 1,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  refreshBtnText: {
    color: '#34A853',
    fontSize: 11,
    fontWeight: '600',
  },
  quickAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weightInputWrap: {
    width: 44,
    height: 42,
    backgroundColor: '#202124',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  weightInput: {
    color: '#E8EAED',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  prioritySelectBtn: {
    paddingHorizontal: 8,
    height: 42,
    backgroundColor: '#202124',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  prioritySelectText: {
    color: '#8AB4F8',
    fontSize: 11,
    fontWeight: '600',
  },
  addStopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1A73E8',
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 10,
    justifyContent: 'center',
  },
  addStopBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  middleStopItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#202124',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  stopNumCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#1A73E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopNumText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  middleStopName: {
    color: '#E8EAED',
    fontSize: 12,
    fontWeight: '600',
  },
  middleStopAddr: {
    color: '#9AA0A6',
    fontSize: 10,
    marginTop: 1,
  },
  middleStopMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  metaWeight: {
    color: '#BDC1C6',
    fontSize: 9,
  },
  metaPriority: {
    fontSize: 9,
    fontWeight: '700',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  metaNormal: {
    backgroundColor: 'rgba(138, 180, 248, 0.15)',
    color: '#8AB4F8',
  },
  metaHigh: {
    backgroundColor: 'rgba(251, 188, 4, 0.15)',
    color: '#FBBC04',
  },
  metaUrgent: {
    backgroundColor: 'rgba(234, 67, 53, 0.15)',
    color: '#EA4335',
  },
  stopActionRow: {
    flexDirection: 'row',
    gap: 4,
  },
  stopActionBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  stopActionBtnLocked: {
    backgroundColor: 'rgba(251, 188, 4, 0.2)',
  },
  emptyStopsBox: {
    padding: 14,
    alignItems: 'center',
    backgroundColor: '#202124',
    borderRadius: 10,
    marginTop: 8,
  },
  emptyStopsText: {
    color: '#9AA0A6',
    fontSize: 11,
  },
  finishOptionsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  finishOptionCard: {
    flex: 1,
    backgroundColor: '#202124',
    borderRadius: 12,
    padding: 9,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  finishOptionCardActiveRed: {
    borderColor: '#EA4335',
    backgroundColor: 'rgba(234, 67, 53, 0.12)',
  },
  finishOptionTitle: {
    color: '#BDC1C6',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  finishOptionTitleActiveRed: {
    color: '#EA4335',
  },
  finishOptionSub: {
    color: '#9AA0A6',
    fontSize: 8,
    textAlign: 'center',
    marginTop: 2,
  },
  innerSearchBox: {
    marginTop: 10,
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#202124',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    height: 42,
  },
  searchInput: {
    flex: 1,
    color: '#E8EAED',
    fontSize: 12,
    paddingHorizontal: 8,
  },
  autocompleteCard: {
    backgroundColor: '#303134',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    marginTop: 4,
    overflow: 'hidden',
    maxHeight: 200,
    zIndex: 30,
  },
  searchingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
  },
  searchingText: {
    color: '#BDC1C6',
    fontSize: 11,
  },
  autocompleteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 9,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  autocompleteName: {
    color: '#E8EAED',
    fontSize: 12,
    fontWeight: '600',
  },
  autocompleteAddr: {
    color: '#9AA0A6',
    fontSize: 10,
    marginTop: 1,
  },
  vehicleSection: {
    marginBottom: 10,
  },
  sectionHeaderLabel: {
    color: '#9AA0A6',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  vehPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#303134',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginRight: 6,
  },
  vehPillActive: {
    backgroundColor: '#1A73E8',
    borderColor: '#8AB4F8',
  },
  vehPillText: {
    color: '#BDC1C6',
    fontSize: 11,
    fontWeight: '600',
  },
  vehPillTextActive: {
    color: '#FFFFFF',
  },
  mapCard: {
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    marginBottom: 12,
    position: 'relative',
    backgroundColor: '#303134',
  },
  mapCardExpanded: {
    height: 360,
  },
  mapCanvas: {
    width: '100%',
    height: '100%',
  },
  mapOverlayHeader: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  mapBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(48, 49, 52, 0.92)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  mapBadgeText: {
    color: '#E8EAED',
    fontSize: 10,
    fontWeight: '600',
  },
  mapExpandToggle: {
    backgroundColor: 'rgba(48, 49, 52, 0.92)',
    padding: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  bigCalculateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1A73E8',
    paddingVertical: 14,
    borderRadius: 16,
    marginBottom: 14,
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  bigCalculateBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  summaryCard: {
    backgroundColor: '#303134',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 14,
    marginBottom: 16,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryTitle: {
    color: '#E8EAED',
    fontSize: 15,
    fontWeight: '700',
  },
  summarySub: {
    color: '#9AA0A6',
    fontSize: 11,
    marginTop: 2,
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(52, 168, 83, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(52, 168, 83, 0.3)',
  },
  scoreBadgeText: {
    color: '#34A853',
    fontSize: 11,
    fontWeight: '700',
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#202124',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  metricItem: {
    alignItems: 'center',
    gap: 2,
  },
  metricLabel: {
    color: '#9AA0A6',
    fontSize: 9,
    fontWeight: '600',
  },
  metricValue: {
    color: '#E8EAED',
    fontSize: 13,
    fontWeight: '700',
  },
  aiReasonBox: {
    backgroundColor: 'rgba(26, 115, 232, 0.12)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(138, 180, 248, 0.25)',
    marginBottom: 8,
  },
  aiReasonText: {
    color: '#E8EAED',
    fontSize: 11,
    lineHeight: 15,
  },
  startNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1A73E8',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 10,
  },
  startNavBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  focusOnMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(52, 168, 83, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(52, 168, 83, 0.3)',
  },
  focusOnMapText: {
    color: '#34A853',
    fontSize: 11,
    fontWeight: '600',
  },
  focusOnMapBtnRed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(234, 67, 53, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(234, 67, 53, 0.3)',
  },
  focusOnMapTextRed: {
    color: '#EA4335',
    fontSize: 11,
    fontWeight: '600',
  },
  middleStopItemSelected: {
    borderColor: '#1A73E8',
    backgroundColor: 'rgba(26, 115, 232, 0.12)',
  },
  inspectHint: {
    color: '#8AB4F8',
    fontSize: 9,
    fontStyle: 'italic',
  },
  mapFitAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(48, 49, 52, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  mapFitAllBtnText: {
    color: '#8AB4F8',
    fontSize: 11,
    fontWeight: '600',
  },
  mapFocusBanner: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(32, 33, 36, 0.94)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#1A73E8',
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 6,
  },
  mapFocusBannerText: {
    color: '#E8EAED',
    fontSize: 11,
    fontWeight: '600',
  },
  mapFocusDismissBtn: {
    backgroundColor: 'rgba(138, 180, 248, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 6,
  },
  mapFocusDismissText: {
    color: '#8AB4F8',
    fontSize: 10,
    fontWeight: '700',
  },
  itinerarySection: {
    marginTop: 10,
    backgroundColor: '#202124',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  itineraryTitle: {
    color: '#9AA0A6',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  itineraryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  itineraryPinA: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#34A853',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itineraryPinDrop: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#1A73E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itineraryPinB: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EA4335',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itineraryPinText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  itineraryItemName: {
    color: '#E8EAED',
    fontSize: 12,
    fontWeight: '600',
  },
  itineraryItemAddr: {
    color: '#9AA0A6',
    fontSize: 10,
    marginTop: 1,
  },
  mapFullScreenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(26, 115, 232, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1A73E8',
  },
  fullScreenModalContainer: {
    flex: 1,
    backgroundColor: '#202124',
    position: 'relative',
  },
  fullScreenCanvas: {
    width: '100%',
    height: '100%',
  },
  fsTopBar: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    backgroundColor: 'rgba(32, 33, 36, 0.94)',
    borderRadius: 16,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    zIndex: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  fsCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fsTitleWrap: {
    flex: 1,
  },
  fsTitleText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  fsSubText: {
    color: '#9AA0A6',
    fontSize: 10,
    marginTop: 1,
  },
  fsActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(26, 115, 232, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(26, 115, 232, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fsBottomTray: {
    position: 'absolute',
    bottom: 16,
    left: 12,
    right: 12,
    zIndex: 30,
    gap: 10,
  },
  fsStopsCarousel: {
    gap: 8,
    paddingVertical: 4,
  },
  fsStopCard: {
    width: 175,
    backgroundColor: 'rgba(32, 33, 36, 0.94)',
    borderRadius: 14,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 6,
  },
  fsStopCardActive: {
    borderColor: '#1A73E8',
    backgroundColor: '#303134',
  },
  fsStopCardName: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  fsStopCardAddr: {
    color: '#9AA0A6',
    fontSize: 9,
    marginTop: 2,
  },
  fsBottomNavRow: {
    backgroundColor: '#303134',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  fsNavMetric: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  fsNavSub: {
    color: '#34A853',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  fsNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1A73E8',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  fsNavBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
