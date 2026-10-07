import { create } from 'zustand';
import { CandidateRoute, GeoPoint, TurnStep } from '@/types';

type Coordinate = [number, number];
const OFF_ROUTE_DISTANCE_METERS = Math.max(10, Number(process.env.EXPO_PUBLIC_OFF_ROUTE_DISTANCE_METERS || 50));
const ARRIVAL_RADIUS_METERS = Math.max(10, Number(process.env.EXPO_PUBLIC_ARRIVAL_RADIUS_METERS || 30));

interface NavigationState {
  isNavigating: boolean;
  isRerouting: boolean;
  hasArrived: boolean;
  routeCoordinates: Coordinate[];
  currentStepIndex: number;
  steps: TurnStep[];
  remainingDistanceKm: number;
  remainingDurationMin: number;
  progressPct: number;
  currentRoad: string;
  nextTurnManeuver: string;
  distanceToNextTurnM: number;
  isDeviated: boolean;
  deviationDistanceM: number;
  consecutiveOffRouteFixes: number;
  accurateArrivalFixes: number;
  currentSpeedKmh: number;
  eta: number | null;
  trafficLevel: string;
  activeRoute: CandidateRoute | null;
  routeOrigin: GeoPoint | null;
  routeDestination: GeoPoint | null;
  routeWaypoints: GeoPoint[];

  startNavigation: (
    steps?: TurnStep[],
    totalDistanceKm?: number,
    totalDurationMin?: number,
    coordinates?: Coordinate[],
    context?: {
      route?: CandidateRoute | null;
      origin?: GeoPoint | null;
      destination?: GeoPoint | null;
      waypoints?: GeoPoint[];
    },
  ) => void;
  stopNavigation: () => void;
  updateLocation: (lat: number, lng: number, speedKmh: number, accuracyM: number, destination?: { lat: number; lng: number }) => void;
  setRerouting: (value: boolean) => void;
  setTrafficLevel: (value: string) => void;
  replaceRoute: (steps: TurnStep[], distanceKm: number, durationMin: number, coordinates: Coordinate[]) => void;
}

const radians = (degrees: number) => degrees * Math.PI / 180;

function distanceMeters(a: Coordinate, b: Coordinate): number {
  const dLat = radians(b[0] - a[0]);
  const dLng = radians(b[1] - a[1]);
  const x = dLng * Math.cos(radians((a[0] + b[0]) / 2));
  return 6371000 * Math.sqrt(dLat * dLat + x * x);
}

function distanceToSegmentMeters(point: Coordinate, start: Coordinate, end: Coordinate): { distance: number; fraction: number } {
  const meanLat = radians((start[0] + end[0] + point[0]) / 3);
  const scaleX = Math.cos(meanLat);
  const ax = start[1] * scaleX;
  const ay = start[0];
  const bx = end[1] * scaleX;
  const by = end[0];
  const px = point[1] * scaleX;
  const py = point[0];
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const fraction = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  const nearest: Coordinate = [ay + dy * fraction, (ax + dx * fraction) / scaleX];
  return { distance: distanceMeters(point, nearest), fraction };
}

function matchRouteProgress(point: Coordinate, coordinates: Coordinate[]) {
  let completedMeters = 0;
  let nearestDistance = Infinity;
  let nearestAlong = 0;
  let totalMeters = 0;
  const segmentLengths = coordinates.slice(1).map((coordinate, index) => distanceMeters(coordinates[index], coordinate));
  totalMeters = segmentLengths.reduce((total, length) => total + length, 0);
  for (let index = 0; index < segmentLengths.length; index += 1) {
    const matched = distanceToSegmentMeters(point, coordinates[index], coordinates[index + 1]);
    if (matched.distance < nearestDistance) {
      nearestDistance = matched.distance;
      nearestAlong = completedMeters + segmentLengths[index] * matched.fraction;
    }
    completedMeters += segmentLengths[index];
  }
  return { nearestDistance, completedMeters: nearestAlong, totalMeters };
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  isNavigating: false,
  isRerouting: false,
  hasArrived: false,
  routeCoordinates: [],
  currentStepIndex: 0,
  steps: [],
  remainingDistanceKm: 0,
  remainingDurationMin: 0,
  progressPct: 0,
  currentRoad: '',
  nextTurnManeuver: 'Waiting for route guidance',
  distanceToNextTurnM: 0,
  isDeviated: false,
  deviationDistanceM: 0,
  consecutiveOffRouteFixes: 0,
  accurateArrivalFixes: 0,
  currentSpeedKmh: 0,
  eta: null,
  trafficLevel: 'Unavailable',
  activeRoute: null,
  routeOrigin: null,
  routeDestination: null,
  routeWaypoints: [],

  startNavigation: (steps = [], totalDistanceKm = 0, totalDurationMin = 0, coordinates = [], context) => set({
    isNavigating: true,
    isRerouting: false,
    hasArrived: false,
    currentStepIndex: 0,
    steps,
    routeCoordinates: coordinates,
    remainingDistanceKm: totalDistanceKm,
    remainingDurationMin: totalDurationMin,
    progressPct: 0,
    currentRoad: steps[0]?.road_name || '',
    nextTurnManeuver: steps[0]?.instruction || 'Continue on the planned route',
    distanceToNextTurnM: steps[0]?.distance_m || 0,
    isDeviated: false,
    deviationDistanceM: 0,
    consecutiveOffRouteFixes: 0,
    accurateArrivalFixes: 0,
    eta: Date.now() + totalDurationMin * 60_000,
    currentSpeedKmh: 0,
    activeRoute: context?.route ?? null,
    routeOrigin: context?.origin ?? null,
    routeDestination: context?.destination ?? null,
    routeWaypoints: context?.waypoints ?? [],
  }),

  stopNavigation: () => set({
    isNavigating: false,
    isRerouting: false,
    isDeviated: false,
    hasArrived: false,
    routeCoordinates: [],
    steps: [],
    progressPct: 0,
    currentSpeedKmh: 0,
    activeRoute: null,
    routeOrigin: null,
    routeDestination: null,
    routeWaypoints: [],
  }),

  updateLocation: (lat, lng, speedKmh, accuracyM, destination) => {
    const state = get();
    if (!state.isNavigating || state.routeCoordinates.length < 2) return;
    const match = matchRouteProgress([lat, lng], state.routeCoordinates);
    const offRoute = accuracyM <= OFF_ROUTE_DISTANCE_METERS && match.nearestDistance > OFF_ROUTE_DISTANCE_METERS;
    const offRouteCount = offRoute ? state.consecutiveOffRouteFixes + 1 : 0;
    const arrived = Boolean(destination && accuracyM <= ARRIVAL_RADIUS_METERS && distanceMeters([lat, lng], [destination.lat, destination.lng]) <= ARRIVAL_RADIUS_METERS);
    const arrivalCount = arrived ? state.accurateArrivalFixes + 1 : 0;
    const remainingMeters = Math.max(0, match.totalMeters - match.completedMeters);
    const progress = match.totalMeters > 0 ? Math.min(100, match.completedMeters / match.totalMeters * 100) : 0;

    let coveredStepDistance = 0;
    let stepIndex = 0;
    while (stepIndex < state.steps.length - 1 && coveredStepDistance + (state.steps[stepIndex]?.distance_m || 0) < match.completedMeters) {
      coveredStepDistance += state.steps[stepIndex]?.distance_m || 0;
      stepIndex += 1;
    }
    const step = state.steps[stepIndex];
    const distanceToTurn = step ? Math.max(0, coveredStepDistance + step.distance_m - match.completedMeters) : 0;
    const remainingDuration = match.totalMeters > 0
      ? state.remainingDurationMin * (remainingMeters / Math.max(1, match.totalMeters - (state.progressPct / 100 * match.totalMeters)))
      : state.remainingDurationMin;

    set({
      currentSpeedKmh: Number.isFinite(speedKmh) ? Math.max(0, speedKmh) : 0,
      remainingDistanceKm: Number((remainingMeters / 1000).toFixed(2)),
      remainingDurationMin: Math.max(0, Number(remainingDuration.toFixed(1))),
      progressPct: Number(progress.toFixed(1)),
      currentStepIndex: stepIndex,
      currentRoad: step?.road_name || '',
      nextTurnManeuver: step?.instruction || 'Continue to destination',
      distanceToNextTurnM: distanceToTurn,
      isDeviated: offRouteCount >= 3,
      deviationDistanceM: Math.round(match.nearestDistance),
      consecutiveOffRouteFixes: offRouteCount,
      accurateArrivalFixes: arrivalCount,
      hasArrived: arrivalCount >= 2,
      eta: Date.now() + remainingDuration * 60_000,
    });
  },

  setRerouting: (value) => set({ isRerouting: value }),
  setTrafficLevel: (value) => set({ trafficLevel: value }),
  replaceRoute: (steps, distanceKm, durationMin, coordinates) => set({
    isRerouting: false,
    isDeviated: false,
    consecutiveOffRouteFixes: 0,
    steps,
    routeCoordinates: coordinates,
    currentStepIndex: 0,
    remainingDistanceKm: distanceKm,
    remainingDurationMin: durationMin,
    progressPct: 0,
    currentRoad: steps[0]?.road_name || '',
    nextTurnManeuver: steps[0]?.instruction || 'Continue on the new route',
    distanceToNextTurnM: steps[0]?.distance_m || 0,
    eta: Date.now() + durationMin * 60_000,
  }),
}));
