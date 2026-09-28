import { create } from 'zustand';
import { TurnStep, DeviationCheck } from '@/types';

interface NavigationState {
  isNavigating: boolean;
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
  showRerouteModal: boolean;
  rerouteAlternative: {
    title: string;
    timeSavedMin: number;
    fuelSavedL: number;
  } | null;

  startNavigation: (steps?: TurnStep[], totalDistanceKm?: number, totalDurationMin?: number) => void;
  stopNavigation: () => void;
  advanceStep: () => void;
  updateLiveProgress: (currentLat: number, currentLng: number, speedKmh: number) => void;
  triggerDeviation: (deviationM: number) => void;
  dismissReroute: () => void;
  applyReroute: () => void;
}

const DEFAULT_STEPS: TurnStep[] = [
  { instruction: 'Head west on Shivaji Road toward University Circle', distance_m: 1200, duration_s: 140, road_name: 'Shivaji Road' },
  { instruction: 'Take the flyover toward Ganeshkhind Rd / Baner', distance_m: 3500, duration_s: 320, road_name: 'Ganeshkhind Road' },
  { instruction: 'Merge onto Mumbai-Bengaluru Highway (NH 48)', distance_m: 8400, duration_s: 580, road_name: 'NH 48 Bypass' },
  { instruction: 'Take the exit toward Hinjewadi Phase 1 / IT Park', distance_m: 1800, duration_s: 240, road_name: 'Hinjewadi Main Road' },
  { instruction: 'Arrive at Hinjewadi Phase 1 Destination on your left', distance_m: 400, duration_s: 60, road_name: 'Tech Center Way' },
];

export const useNavigationStore = create<NavigationState>((set, get) => ({
  isNavigating: false,
  currentStepIndex: 0,
  steps: DEFAULT_STEPS,
  remainingDistanceKm: 21.4,
  remainingDurationMin: 34.0,
  progressPct: 0,
  currentRoad: 'Shivaji Road',
  nextTurnManeuver: 'In 1.2 km, take the flyover toward Ganeshkhind Rd',
  distanceToNextTurnM: 1200,
  isDeviated: false,
  deviationDistanceM: 0,
  showRerouteModal: false,
  rerouteAlternative: null,

  startNavigation: (steps = DEFAULT_STEPS, totalDistanceKm = 21.4, totalDurationMin = 34.0) => {
    set({
      isNavigating: true,
      currentStepIndex: 0,
      steps: steps.length > 0 ? steps : DEFAULT_STEPS,
      remainingDistanceKm: totalDistanceKm,
      remainingDurationMin: totalDurationMin,
      progressPct: 5,
      currentRoad: steps[0]?.road_name || 'Shivaji Road',
      nextTurnManeuver: steps[0]?.instruction || 'Proceed straight',
      distanceToNextTurnM: steps[0]?.distance_m || 500,
      isDeviated: false,
      showRerouteModal: false,
    });
  },

  stopNavigation: () => {
    set({
      isNavigating: false,
      currentStepIndex: 0,
      progressPct: 0,
      isDeviated: false,
      showRerouteModal: false,
    });
  },

  advanceStep: () => {
    const { currentStepIndex, steps, remainingDistanceKm, remainingDurationMin } = get();
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      const step = steps[nextIndex];
      const distDec = step.distance_m / 1000;
      const durDec = step.duration_s / 60;
      set({
        currentStepIndex: nextIndex,
        currentRoad: step.road_name || 'Highway',
        nextTurnManeuver: step.instruction,
        distanceToNextTurnM: step.distance_m,
        remainingDistanceKm: Math.max(0.2, Math.round((remainingDistanceKm - distDec) * 10) / 10),
        remainingDurationMin: Math.max(1, Math.round((remainingDurationMin - durDec) * 10) / 10),
        progressPct: Math.min(95, Math.round(((nextIndex + 1) / steps.length) * 100)),
      });
    } else {
      set({
        progressPct: 100,
        remainingDistanceKm: 0,
        remainingDurationMin: 0,
        nextTurnManeuver: 'You have arrived at your destination',
        distanceToNextTurnM: 0,
      });
    }
  },

  updateLiveProgress: (lat, lng, speedKmh) => {
    // Simulated step distance countdown
    const { distanceToNextTurnM, advanceStep } = get();
    const deltaM = Math.max(10, Math.round((speedKmh * 1000) / 3600 * 2)); // 2 sec tick
    const newDist = distanceToNextTurnM - deltaM;
    if (newDist <= 30) {
      advanceStep();
    } else {
      set({ distanceToNextTurnM: newDist });
    }
  },

  triggerDeviation: (deviationM) => {
    set({
      isDeviated: true,
      deviationDistanceM: deviationM,
      showRerouteModal: true,
      rerouteAlternative: {
        title: 'Bypass Traffic Congestion via Western Outer Ring',
        timeSavedMin: 8,
        fuelSavedL: 0.35,
      },
    });
  },

  dismissReroute: () => {
    set({ showRerouteModal: false, isDeviated: false });
  },

  applyReroute: () => {
    const { remainingDurationMin } = get();
    set({
      showRerouteModal: false,
      isDeviated: false,
      remainingDurationMin: Math.max(10, remainingDurationMin - 8),
      nextTurnManeuver: 'Turn right in 200m onto Western Outer Ring Bypass',
      distanceToNextTurnM: 200,
    });
  },
}));
