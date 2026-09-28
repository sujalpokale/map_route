import { create } from 'zustand';
import { TripRecord } from '@/types';

interface TripState {
  trips: TripRecord[];
  activeTrip: TripRecord | null;
  totalFuelSavedLitres: number;
  totalCostSavedInr: number;
  totalDistanceKm: number;

  startTrip: (originName: string, destinationName: string, distanceKm: number, plannedDurationMin: number) => void;
  completeActiveTrip: (actualDurationMin: number, fuelLitres: number, fuelCostInr: number) => void;
}

const HISTORICAL_TRIPS: TripRecord[] = [
  {
    id: 'trip_101',
    start_time: 'Yesterday, 09:30 AM',
    end_time: 'Yesterday, 10:48 AM',
    origin_name: 'Shivaji Nagar Hub',
    destination_name: 'Hinjewadi Tech Corridor',
    distance_km: 24.2,
    duration_min: 36,
    planned_duration_min: 42,
    fuel_litres: 1.8,
    fuel_cost_inr: 189.0,
    score: 95,
    stops_completed: 4,
    co2_saved_kg: 1.4,
  },
  {
    id: 'trip_102',
    start_time: '24 Sep, 02:15 PM',
    end_time: '24 Sep, 04:05 PM',
    origin_name: 'Hadapsar Industrial Zone',
    destination_name: 'Chakan Auto Hub',
    distance_km: 48.6,
    duration_min: 68,
    planned_duration_min: 78,
    fuel_litres: 3.9,
    fuel_cost_inr: 409.5,
    score: 92,
    stops_completed: 6,
    co2_saved_kg: 2.8,
  },
  {
    id: 'trip_103',
    start_time: '22 Sep, 11:00 AM',
    end_time: '22 Sep, 12:20 PM',
    origin_name: 'Kalyani Nagar',
    destination_name: 'Bavdhan Valley',
    distance_km: 19.8,
    duration_min: 32,
    planned_duration_min: 38,
    fuel_litres: 1.5,
    fuel_cost_inr: 157.5,
    score: 96,
    stops_completed: 2,
    co2_saved_kg: 1.1,
  },
];

export const useTripStore = create<TripState>((set) => ({
  trips: HISTORICAL_TRIPS,
  activeTrip: null,
  totalFuelSavedLitres: 128.4,
  totalCostSavedInr: 13482,
  totalDistanceKm: 3840.5,

  startTrip: (originName, destinationName, distanceKm, plannedDurationMin) => {
    const newTrip: TripRecord = {
      id: `trip_${Date.now()}`,
      start_time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      origin_name: originName,
      destination_name: destinationName,
      distance_km: distanceKm,
      duration_min: 0,
      planned_duration_min: plannedDurationMin,
      fuel_litres: 0,
      fuel_cost_inr: 0,
      score: 94,
      stops_completed: 0,
      co2_saved_kg: 0,
    };
    set({ activeTrip: newTrip });
  },

  completeActiveTrip: (actualDurationMin, fuelLitres, fuelCostInr) => {
    set((state) => {
      if (!state.activeTrip) return state;
      const completed: TripRecord = {
        ...state.activeTrip,
        end_time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        duration_min: actualDurationMin,
        fuel_litres: fuelLitres,
        fuel_cost_inr: fuelCostInr,
        co2_saved_kg: Math.round(fuelLitres * 0.8 * 10) / 10,
      };
      return {
        activeTrip: null,
        trips: [completed, ...state.trips],
        totalDistanceKm: state.totalDistanceKm + completed.distance_km,
        totalCostSavedInr: state.totalCostSavedInr + Math.round(fuelCostInr * 0.15),
      };
    });
  },
}));
