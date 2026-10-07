import { create } from 'zustand';
import {
  CandidateRoute,
  GeoPoint,
  OptimizationMode,
  StopItem,
} from '@/types';
import { routeService } from '@/services/api/routes';
import { trafficService } from '@/services/api/traffic';
import { useVehicleStore } from './useVehicleStore';

interface MultiStopState {
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

  setOrigin: (point: GeoPoint | null) => void;
  setDestination: (point: GeoPoint | null) => void;
  setOptimizationMode: (mode: OptimizationMode) => void;
  addStop: (stop: StopItem) => void;
  removeStop: (id: string) => void;
  toggleStopLock: (id: string) => void;
  reorderStops: (stops: StopItem[]) => void;
  setSelectedRouteId: (id: string | null) => void;
  resetPlanner: () => void;
  optimizeMultiStops: () => Promise<boolean>;
  calculateMultiStopTour: (vehicleType?: string) => Promise<boolean>;
  getSelectedRoute: () => CandidateRoute | null;
}

function clearCalculatedState() {
  return {
    candidateRoutes: [] as CandidateRoute[],
    selectedRouteId: null as string | null,
    waypoints: [] as GeoPoint[],
    metadata: null as Record<string, any> | null,
    error: null as string | null,
  };
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Multi-stop sequencing: nearest-neighbour seed followed by 2-opt local search.
 * This state belongs only to the Multi-Stop planner.
 */
function solveNearestNeighbor2Opt(
  origin: GeoPoint,
  stops: StopItem[],
  destination?: GeoPoint | null,
): StopItem[] {
  if (stops.length <= 1) return [...stops];

  const unvisited = [...stops];
  const tour: StopItem[] = [];
  let currentLat = origin.lat;
  let currentLng = origin.lng;

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let minScore = Infinity;

    for (let i = 0; i < unvisited.length; i += 1) {
      const stop = unvisited[i];
      const distance = haversineKm(currentLat, currentLng, stop.lat, stop.lng);
      const priorityWeight = stop.priority === 3 ? 0.75 : stop.priority === 2 ? 0.9 : 1;
      const score = distance * priorityWeight;

      if (score < minScore) {
        minScore = score;
        nearestIdx = i;
      }
    }

    const next = unvisited.splice(nearestIdx, 1)[0];
    tour.push(next);
    currentLat = next.lat;
    currentLng = next.lng;
  }

  const totalDistance = (route: StopItem[]) => {
    if (!route.length) return 0;

    let distance = haversineKm(origin.lat, origin.lng, route[0].lat, route[0].lng);

    for (let i = 0; i < route.length - 1; i += 1) {
      distance += haversineKm(
        route[i].lat,
        route[i].lng,
        route[i + 1].lat,
        route[i + 1].lng,
      );
    }

    if (destination) {
      const last = route[route.length - 1];
      distance += haversineKm(last.lat, last.lng, destination.lat, destination.lng);
    }

    return distance;
  };

  let bestDistance = totalDistance(tour);
  let improved = true;
  let iterations = 0;

  while (improved && iterations < 50) {
    improved = false;
    iterations += 1;

    for (let i = 0; i < tour.length - 1; i += 1) {
      for (let k = i + 1; k < tour.length; k += 1) {
        if (tour[i].is_locked || tour[k].is_locked) continue;

        const candidate = [
          ...tour.slice(0, i),
          ...tour.slice(i, k + 1).reverse(),
          ...tour.slice(k + 1),
        ];

        const distance = totalDistance(candidate);
        if (distance < bestDistance - 0.001) {
          tour.splice(0, tour.length, ...candidate);
          bestDistance = distance;
          improved = true;
          break;
        }
      }

      if (improved) break;
    }
  }

  return tour;
}

export const useMultiStopStore = create<MultiStopState>((set, get) => ({
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

  setOrigin: (point) =>
    set((state) => ({
      origin: point,
      ...clearCalculatedState(),
      destination: point === null ? null : state.destination,
      stops: state.stops,
    })),

  setDestination: (point) =>
    set({
      destination: point,
      ...clearCalculatedState(),
    }),

  setOptimizationMode: (mode) => set({ optimizationMode: mode }),

  addStop: (stop) =>
    set((state) => ({
      stops: [...state.stops, stop],
      ...clearCalculatedState(),
    })),

  removeStop: (id) =>
    set((state) => ({
      stops: state.stops.filter((stop) => stop.id !== id),
      ...clearCalculatedState(),
    })),

  toggleStopLock: (id) =>
    set((state) => ({
      stops: state.stops.map((stop) =>
        stop.id === id ? { ...stop, is_locked: !stop.is_locked } : stop,
      ),
      ...clearCalculatedState(),
    })),

  reorderStops: (stops) =>
    set({
      stops,
      ...clearCalculatedState(),
    }),

  setSelectedRouteId: (id) => set({ selectedRouteId: id }),

  resetPlanner: () =>
    set({
      origin: null,
      destination: null,
      waypoints: [],
      stops: [],
      candidateRoutes: [],
      selectedRouteId: null,
      isLoading: false,
      error: null,
      metadata: null,
    }),

  optimizeMultiStops: async () => {
    const { origin, destination, stops } = get();

    if (!stops.length) {
      set({ error: 'Add at least one stop first.', isLoading: false });
      return false;
    }

    if (!origin) {
      set({ error: 'Select a start location before optimizing stops.', isLoading: false });
      return false;
    }

    set({ isLoading: true, error: null });

    try {
      const response = await routeService.optimizeStops({
        origin,
        destination: destination || undefined,
        stops,
      });

      if (response?.ordered_stops?.length) {
        set({
          stops: response.ordered_stops,
          isLoading: false,
        });
        return true;
      }
    } catch {
      // Fall through to deterministic client-side optimization.
    }

    const optimizedStops = solveNearestNeighbor2Opt(origin, stops, destination);
    set({
      stops: optimizedStops,
      isLoading: false,
    });
    return true;
  },

  calculateMultiStopTour: async (vehicleType = 'CAR') => {
    const state = get();
    const vehicle = useVehicleStore.getState().getSelectedVehicle();

    if (!state.origin) {
      set({ error: 'Select a start location before calculating the route.', isLoading: false });
      return false;
    }

    if (!state.stops.length) {
      set({ error: 'Add at least one stop before calculating the route.', isLoading: false });
      return false;
    }

    set({ isLoading: true, error: null });

    const optimized = await get().optimizeMultiStops();
    if (!optimized) return false;

    const orderedStops = get().stops;

    let destination: GeoPoint;
    let waypoints: GeoPoint[];

    const currentDestination = get().destination;

    if (
      currentDestination &&
      orderedStops.length > 0 &&
      (currentDestination.lat !== orderedStops[orderedStops.length - 1].lat ||
        currentDestination.lng !== orderedStops[orderedStops.length - 1].lng)
    ) {
      destination = currentDestination;
      waypoints = orderedStops.map((stop) => ({
        lat: stop.lat,
        lng: stop.lng,
        name: stop.name || stop.address,
        address: stop.address,
      }));
    } else {
      const finalStop = orderedStops[orderedStops.length - 1];
      destination = {
        lat: finalStop.lat,
        lng: finalStop.lng,
        name: finalStop.name || finalStop.address,
        address: finalStop.address,
      };
      waypoints = orderedStops.slice(0, -1).map((stop) => ({
        lat: stop.lat,
        lng: stop.lng,
        name: stop.name || stop.address,
        address: stop.address,
      }));
    }

    set({ destination, waypoints, isLoading: true, error: null });

    try {
      const response = await trafficService.calculateTrafficAwareRoute({
        origin: get().origin!,
        destination,
        waypoints,
        vehicle_type: vehicleType as any,
        fuel_type: vehicle.fuel_type,
        fuel_efficiency_kmpl: vehicle.efficiency_kmpl,
        fuel_price_inr: vehicle.fuel_price_inr,
        optimization_mode: get().optimizationMode,
      });

      if (response?.routes?.length) {
        set({
          candidateRoutes: response.routes,
          selectedRouteId: response.best_route_id || response.routes[0].id,
          metadata: response.metadata || null,
          isLoading: false,
          error: null,
        });
        return true;
      }
    } catch {
      // Keep the user's inputs intact and expose the provider failure.
    }

    set({
      candidateRoutes: [],
      selectedRouteId: null,
      metadata: null,
      isLoading: false,
      error: 'No routing provider is available. Check the API connection and try again.',
    });
    return false;
  },

  getSelectedRoute: () => {
    const { candidateRoutes, selectedRouteId } = get();
    return candidateRoutes.find((route) => route.id === selectedRouteId) || candidateRoutes[0] || null;
  },
}));
