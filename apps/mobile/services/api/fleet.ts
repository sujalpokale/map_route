import { apiClient } from './client';
import { GPSLocation } from '@/types';

export const fleetService = {
  async sendTelematics(payload: {
    vehicle_id: string;
    driver_id: string;
    location: GPSLocation;
    trip_id?: string;
    fuel_level_pct?: number;
    battery_pct?: number;
    status?: 'IDLE' | 'EN_ROUTE' | 'DELIVERING' | 'OFFLINE';
  }) {
    return apiClient.post('/fleet/telematics', payload);
  },

  async getFleetStatus() {
    return apiClient.get<any>('/fleet/vehicles');
  },
};

export const analyticsService = {
  async getSummary(period: 'today' | 'week' | 'month' = 'month') {
    return apiClient.get<any>('/analytics/summary', { period });
  },

  async logCompletedTrip(tripData: any) {
    return apiClient.post('/analytics/trip-complete', tripData);
  },
};
