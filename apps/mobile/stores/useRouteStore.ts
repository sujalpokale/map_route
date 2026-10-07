import { create } from 'zustand';
import {
  GeoPoint,
  CandidateRoute,
  OptimizationMode,
  StopItem,
  RouteCalculateResponse,
} from '@/types';
import { routeService } from '@/services/api/routes';
import { trafficService } from '@/services/api/traffic';
import { useVehicleStore } from './useVehicleStore';

interface RouteState {
  origin: GeoPoint | null;
  destination: GeoPoint | null;
  waypoints: GeoPoint[];
  stops: StopItem[];
  optimizationMode: OptimizationMode;
  candidateRoutes: CandidateRoute[];
  selectedRouteId: string | null;
  isLoading: boolean;
  error: string | null;
  metadata: Record<string, any> | null;

  setOrigin: (point: GeoPoint) => void;
  setDestination: (point: GeoPoint | null) => void;
  addWaypoint: (point: GeoPoint) => void;
  removeWaypoint: (index: number) => void;
  setOptimizationMode: (mode: OptimizationMode) => void;
  addStop: (stop: StopItem) => void;
  removeStop: (id: string) => void;
  toggleStopLock: (id: string) => void;
  reorderStops: (stops: StopItem[]) => void;
  setSelectedRouteId: (id: string) => void;
  calculateRoutes: (vehicleType?: string, payloadKg?: number) => Promise<boolean>;
  optimizeMultiStops: () => Promise<boolean>;
  calculateMultiStopTour: (vehicleType?: string) => Promise<boolean>;
  getSelectedRoute: () => CandidateRoute | null;
  /**
   * Remove stale single-route draft/results before entering the Multi-Stop planner.
   * The live origin and any existing multi-stop stops are intentionally preserved.
   */
  prepareForMultiStop: () => boolean;
}

const DEFAULT_ORIGIN: GeoPoint = {
  lat: 18.5204,
  lng: 73.8567,
  name: 'Current Location',
  address: 'Shivaji Nagar, Pune, Maharashtra',
  city: 'Pune',
};

const DEFAULT_DESTINATION: GeoPoint = {
  lat: 18.5987,
  lng: 73.7178,
  name: 'Hinjewadi Phase 1 IT Park',
  address: 'Hinjewadi Phase 1, Pune, Maharashtra 411057',
  city: 'Pune',
};

const DEFAULT_STOPS: StopItem[] = [
  {
    id: 'stop_1',
    name: 'Customer A — Electronics Delivery',
    address: 'Baner High Street, Pune',
    lat: 18.559,
    lng: 73.7868,
    priority: 3, // Urgent
    time_window_start: '10:00',
    time_window_end: '12:00',
    package_weight_kg: 15,
    is_locked: false,
    status: 'PENDING',
  } as any,
  {
    id: 'stop_2',
    name: 'Customer B — Fresh Groceries',
    address: 'Wakad Bridge, Pune',
    lat: 18.598,
    lng: 73.765,
    priority: 1, // Normal
    time_window_start: '11:00',
    time_window_end: '14:00',
    package_weight_kg: 8,
    is_locked: false,
    status: 'PENDING',
  } as any,
  {
    id: 'stop_3',
    name: 'Customer C — Office Supplies',
    address: 'Kothrud Depot, Pune',
    lat: 18.5074,
    lng: 73.8077,
    priority: 2, // High
    time_window_start: '13:00',
    time_window_end: '16:00',
    package_weight_kg: 24,
    is_locked: false,
    status: 'PENDING',
  } as any,
];

// High quality fallback candidate routes for offline / immediate demo display
const MOCK_CANDIDATE_ROUTES: CandidateRoute[] = [
  {
    id: 'route_irs_balanced',
    label: 'IRS Balanced Highway (Recommended)',
    distance_km: 21.4,
    duration_min: 34.0,
    eta_iso: '10:48 AM',
    fuel_litres: 1.62,
    fuel_cost_inr: 170.1,
    toll_cost_inr: 0,
    driver_cost_inr: 85.0,
    maintenance_cost_inr: 32.1,
    total_cost_inr: 287.2,
    traffic_delay_min: 4.2,
    traffic_level: 'Moderate',
    weather_condition: 'Clear Sky 28°C',
    road_quality: 'Smooth Highway',
    overall_score: 93.4,
    sub_scores: {
      time_score: 91.0,
      fuel_score: 94.2,
      cost_score: 95.0,
      traffic_score: 88.5,
      distance_score: 92.0,
      weather_score: 98.0,
      road_condition_score: 96.0,
      safety_score: 94.0,
      vehicle_compatibility_score: 96.0,
    },
    recommendation_reason: 'Optimal trade-off: 6 min faster than arterial routes, saves 0.4L fuel via free-flowing bypass corridor.',
    is_recommended: true,
    coordinates: [
      [18.5204, 73.8567],
      [18.5312, 73.8445],
      [18.5521, 73.8211],
      [18.5590, 73.7868],
      [18.5780, 73.7712],
      [18.5980, 73.7650],
      [18.5987, 73.7178],
    ],
    steps: [
      { instruction: 'Head west on Shivaji Road toward University Circle', distance_m: 1200, duration_s: 140, road_name: 'Shivaji Road' },
      { instruction: 'Take the flyover toward Ganeshkhind Rd / Baner', distance_m: 3500, duration_s: 320, road_name: 'Ganeshkhind Road' },
      { instruction: 'Merge onto Mumbai-Bengaluru Highway (NH 48)', distance_m: 8400, duration_s: 580, road_name: 'NH 48 Bypass' },
      { instruction: 'Take the exit toward Hinjewadi Phase 1 / IT Park', distance_m: 1800, duration_s: 240, road_name: 'Hinjewadi Main Road' },
      { instruction: 'Arrive at Hinjewadi Phase 1 Destination on your left', distance_m: 400, duration_s: 60, road_name: 'Tech Center Way' },
    ],
  },
  {
    id: 'route_irs_fastest',
    label: 'Express Expressway Detour',
    distance_km: 24.8,
    duration_min: 31.0,
    eta_iso: '10:45 AM',
    fuel_litres: 1.89,
    fuel_cost_inr: 198.5,
    toll_cost_inr: 45.0,
    driver_cost_inr: 77.5,
    maintenance_cost_inr: 37.2,
    total_cost_inr: 358.2,
    traffic_delay_min: 1.5,
    traffic_level: 'Low',
    weather_condition: 'Clear Sky 28°C',
    road_quality: 'Grade A Expressway',
    overall_score: 87.2,
    sub_scores: {
      time_score: 98.0,
      fuel_score: 82.0,
      cost_score: 76.5,
      traffic_score: 97.0,
      distance_score: 81.0,
      weather_score: 98.0,
      road_condition_score: 99.0,
      safety_score: 95.0,
      vehicle_compatibility_score: 94.0,
    },
    recommendation_reason: 'Fastest arrival time, but incurs ₹45 toll and slightly higher fuel consumption.',
    is_recommended: false,
    coordinates: [
      [18.5204, 73.8567],
      [18.5400, 73.8300],
      [18.5600, 73.7900],
      [18.5850, 73.7500],
      [18.6100, 73.7300],
      [18.5987, 73.7178],
    ],
  },
  {
    id: 'route_irs_cheapest',
    label: 'Direct City Arterial (Zero Toll)',
    distance_km: 18.2,
    duration_min: 44.0,
    eta_iso: '10:58 AM',
    fuel_litres: 1.55,
    fuel_cost_inr: 162.8,
    toll_cost_inr: 0,
    driver_cost_inr: 110.0,
    maintenance_cost_inr: 27.3,
    total_cost_inr: 300.1,
    traffic_delay_min: 12.8,
    traffic_level: 'High',
    weather_condition: 'Clear Sky 28°C',
    road_quality: 'Urban Congestion',
    overall_score: 81.5,
    sub_scores: {
      time_score: 72.0,
      fuel_score: 91.0,
      cost_score: 92.0,
      traffic_score: 64.0,
      distance_score: 98.0,
      weather_score: 95.0,
      road_condition_score: 82.0,
      safety_score: 84.0,
      vehicle_compatibility_score: 88.0,
    },
    recommendation_reason: 'Shortest physical distance with zero tolls, but experiences 13 min of stop-and-go junction delays.',
    is_recommended: false,
    coordinates: [
      [18.5204, 73.8567],
      [18.5300, 73.8100],
      [18.5500, 73.7700],
      [18.5800, 73.7400],
      [18.5987, 73.7178],
    ],
  },
];

function computeHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Solves Multi-Stop TSP using Nearest-Neighbor Greedy Seed + 2-Opt Local Search Optimization
 * Logic: Start Hub (A) -> Nearest Stop -> Next Nearest Stop -> ... -> End Point (B)
 */
export function solveTSPNearestNeighbor2Opt(
  origin: GeoPoint,
  stops: StopItem[],
  destination?: GeoPoint | null
): StopItem[] {
  if (stops.length <= 1) return [...stops];

  const unvisited = [...stops];
  const tour: StopItem[] = [];

  let currentLat = origin.lat;
  let currentLng = origin.lng;

  // 1. Nearest-Neighbor: from current location (A), always select the closest unvisited stop
  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let minDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const stop = unvisited[i];
      const dist = computeHaversineDistance(currentLat, currentLng, stop.lat, stop.lng);
      // Priority weighting: urgent stops get preference
      const priorityWeight = stop.priority === 3 ? 0.75 : stop.priority === 2 ? 0.9 : 1.0;
      const score = dist * priorityWeight;

      if (score < minDistance) {
        minDistance = score;
        nearestIdx = i;
      }
    }

    const nextStop = unvisited.splice(nearestIdx, 1)[0];
    tour.push(nextStop);
    currentLat = nextStop.lat;
    currentLng = nextStop.lng;
  }

  // 2. 2-Opt TSP Local Search: Swap pairs of edges if total path distance decreases
  let improved = true;
  let iterations = 0;
  const maxIterations = 50;

  const calculateTotalTourDistance = (route: StopItem[]): number => {
    let d = computeHaversineDistance(origin.lat, origin.lng, route[0].lat, route[0].lng);
    for (let i = 0; i < route.length - 1; i++) {
      d += computeHaversineDistance(route[i].lat, route[i].lng, route[i + 1].lat, route[i + 1].lng);
    }
    if (destination && destination.lat && destination.lng) {
      d += computeHaversineDistance(route[route.length - 1].lat, route[route.length - 1].lng, destination.lat, destination.lng);
    }
    return d;
  };

  let bestDistance = calculateTotalTourDistance(tour);

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 0; i < tour.length - 1; i++) {
      for (let k = i + 1; k < tour.length; k++) {
        if (tour[i].is_locked || tour[k].is_locked) continue;

        const newTour = [
          ...tour.slice(0, i),
          ...tour.slice(i, k + 1).reverse(),
          ...tour.slice(k + 1),
        ];

        const newDistance = calculateTotalTourDistance(newTour);
        if (newDistance < bestDistance - 0.001) {
          tour.splice(0, tour.length, ...newTour);
          bestDistance = newDistance;
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }

  return tour;
}

export const useRouteStore = create<RouteState>((set, get) => ({
  origin: null,
  destination: null,
  waypoints: [],
  stops: [],
  optimizationMode: 'Balanced',
  candidateRoutes: [],
  selectedRouteId: null,
  isLoading: false,
  error: null,
  metadata: null,

  setOrigin: (point) => set({ origin: point }),
  setDestination: (point) => set({ destination: point }),
  addWaypoint: (point) => set((state) => ({ waypoints: [...state.waypoints, point] })),
  removeWaypoint: (index) =>
    set((state) => ({ waypoints: state.waypoints.filter((_, i) => i !== index) })),
  setOptimizationMode: (mode) => set({ optimizationMode: mode }),

  addStop: (stop) => set((state) => ({ stops: [...state.stops, stop] })),
  removeStop: (id) => set((state) => ({ stops: state.stops.filter((s) => s.id !== id) })),
  toggleStopLock: (id) =>
    set((state) => ({
      stops: state.stops.map((s) => (s.id === id ? { ...s, is_locked: !s.is_locked } : s)),
    })),
  reorderStops: (newStops) => set({ stops: newStops }),
  setSelectedRouteId: (id) => set({ selectedRouteId: id }),

  prepareForMultiStop: () => {
    const { stops, destination, waypoints, candidateRoutes } = get();
    const hasStaleSingleRouteState =
      stops.length === 0 &&
      (!!destination || waypoints.length > 0 || candidateRoutes.length > 0);

    if (!hasStaleSingleRouteState) {
      return false;
    }

    // Preserve the real/live origin; clear only route-specific state that can
    // leak from the single-route planner into the Multi-Stop planner.
    set({
      destination: null,
      waypoints: [],
      candidateRoutes: [],
      selectedRouteId: null,
      metadata: null,
      error: null,
    });
    return true;
  },

  calculateRoutes: async (vehicleType = 'CAR', payloadKg = 0) => {
    const { origin, destination, waypoints, optimizationMode } = get();
    const vehicle = useVehicleStore.getState().getSelectedVehicle();
    if (!origin || !destination || !destination.lat || !destination.lng) {
      set({
        candidateRoutes: [], selectedRouteId: null, isLoading: false,
        error: !origin ? 'Set a real starting location before calculating the route.' : 'Set a destination before calculating the route.',
      });
      return false;
    }
    set({ isLoading: true, error: null });

    // 1. Keep provider credentials on the backend and prefer its configured provider.
    try {
      const response = await trafficService.calculateTrafficAwareRoute({
        origin,
        destination: destination || undefined,
        waypoints,
        vehicle_type: vehicleType as any,
        fuel_type: vehicle.fuel_type,
        fuel_efficiency_kmpl: vehicle.efficiency_kmpl,
        fuel_price_inr: vehicle.fuel_price_inr,
        optimization_mode: optimizationMode,
        payload_kg: payloadKg,
      });
      if (response && response.routes.length > 0) {
        set({
          candidateRoutes: response.routes,
          selectedRouteId: response.best_route_id || response.routes[0].id,
          metadata: response.metadata || null,
          isLoading: false,
        });
        return true;
      }
    } catch {
      // Fall through to backend API
    }

    set({
      candidateRoutes: [],
      selectedRouteId: null,
      isLoading: false,
      error: 'No routing provider is available. Check the API connection and try again.',
    });
    return false;
  },

  optimizeMultiStops: async () => {
    const { origin, destination, stops } = get();
    if (!stops || stops.length === 0) return true;
    if (!origin) {
      set({ error: 'Set a real starting location before optimizing stops.', isLoading: false });
      return false;
    }
    set({ isLoading: true, error: null });

    try {
      const response = await routeService.optimizeStops({
        origin,
        destination: destination || undefined,
        stops,
      });

      if (response && response.ordered_stops && response.ordered_stops.length > 0) {
        set({
          stops: response.ordered_stops,
          isLoading: false,
        });
        return true;
      }
    } catch {
      // Fallback gracefully to client-side TSP
    }

    // Exact Nearest-Neighbor + 2-Opt TSP algorithm on client side
    const optimizedStops = solveTSPNearestNeighbor2Opt(origin, stops, destination);
    set({ stops: optimizedStops, isLoading: false });
    return true;
  },

  calculateMultiStopTour: async (vehicleType = 'CAR') => {
    const { origin, destination: currentDest, stops, optimizeMultiStops } = get();
    const vehicle = useVehicleStore.getState().getSelectedVehicle();
    if (!origin || !stops || stops.length === 0) {
      set({ error: !origin ? 'Set a real starting location before optimizing stops.' : 'Add at least one stop first.' });
      return false;
    }
    set({ isLoading: true, error: null });

    // 1. Run Nearest-Neighbor + 2-Opt TSP sequencer
    if (!await optimizeMultiStops()) return false;
    const orderedStops = get().stops;

    // 2. Formulate waypoints and destination
    let destPoint: GeoPoint;
    let waypoints: GeoPoint[];

    if (currentDest && currentDest.lat && currentDest.lng && currentDest.lat !== orderedStops[orderedStops.length - 1].lat) {
      // User has custom destination (e.g. Return to Start or Custom Hub)
      waypoints = orderedStops.map((s) => ({
        lat: s.lat,
        lng: s.lng,
        name: s.name || s.address,
        address: s.address,
      }));
      destPoint = currentDest;
    } else {
      // Last drop is destination
      const finalDest = orderedStops[orderedStops.length - 1];
      waypoints = orderedStops.slice(0, orderedStops.length - 1).map((s) => ({
        lat: s.lat,
        lng: s.lng,
        name: s.name || s.address,
        address: s.address,
      }));
      destPoint = {
        lat: finalDest.lat,
        lng: finalDest.lng,
        name: finalDest.name || finalDest.address,
        address: finalDest.address,
      };
      set({ destination: destPoint });
    }

    set({ waypoints });

    // 3. Keep route-provider access on FastAPI for multi-stop routing too.
    try {
      const response = await trafficService.calculateTrafficAwareRoute({
        origin,
        destination: destPoint,
        waypoints,
        vehicle_type: vehicleType as any,
        fuel_type: vehicle.fuel_type,
        fuel_efficiency_kmpl: vehicle.efficiency_kmpl,
        fuel_price_inr: vehicle.fuel_price_inr,
        optimization_mode: get().optimizationMode,
      });
      if (response?.routes.length) {
        set({
          candidateRoutes: response.routes,
          selectedRouteId: response.best_route_id || response.routes[0].id,
          metadata: response.metadata || null,
          isLoading: false,
        });
        return true;
      }
    } catch {
      // Fall through to a backend route calculation without multi-stop waypoints.
    }

    // Fallback calculation
    const ok = await get().calculateRoutes(vehicleType);
    set({ isLoading: false });
    return ok;
  },

  getSelectedRoute: () => {
    const { candidateRoutes, selectedRouteId } = get();
    return candidateRoutes.find((r) => r.id === selectedRouteId) || candidateRoutes[0] || null;
  },
}));
