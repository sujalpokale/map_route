import { create } from 'zustand';
import { GPSLocation } from '@/types';

interface LocationState {
  currentLocation: GPSLocation | null;
  hasPermission: boolean | null;
  isTracking: boolean;
  heading: number;
  speedKmh: number;
  accuracyM: number | null;
  lastUpdated: number | null;
  
  setLocation: (location: GPSLocation) => void;
  setPermission: (granted: boolean) => void;
  setTracking: (tracking: boolean) => void;
  updateCoordinates: (lat: number, lng: number, speed?: number | null, heading?: number | null, accuracy?: number | null, altitude?: number | null) => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  currentLocation: null,
  hasPermission: null,
  isTracking: false,
  heading: 0,
  speedKmh: 0,
  accuracyM: null,
  lastUpdated: null,

  setLocation: (location) => {
    set({
      currentLocation: location,
      heading: location.heading ?? 0,
      speedKmh: location.speed ? Math.round(location.speed * 3.6) : 0, // m/s to km/h if from raw GPS
      accuracyM: location.accuracy ?? 10,
      lastUpdated: Date.now(),
    });
  },

  setPermission: (granted) => set({ hasPermission: granted }),
  setTracking: (tracking) => set({ isTracking: tracking }),

  updateCoordinates: (lat, lng, speed = null, heading = null, accuracy = null, altitude = null) => {
    set((state) => ({
      currentLocation: {
        latitude: lat,
        longitude: lng,
        altitude,
        accuracy,
        heading,
        speed: speed == null ? null : speed / 3.6,
        timestamp: Date.now(),
      },
      speedKmh: speed == null ? 0 : speed,
      heading: heading ?? 0,
      accuracyM: accuracy,
      lastUpdated: Date.now(),
    }));
  },
}));
