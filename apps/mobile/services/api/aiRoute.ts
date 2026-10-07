import { apiClient } from './client';
import { GeoPoint, RouteCalculateResponse } from '@/types';

export interface RouteIntent {
  origin: string | null;
  use_current_location: boolean;
  destination: string | null;
  waypoints: string[];
  route_preference: string;
  traffic_aware: boolean;
  avoid: string[];
  navigation: boolean;
}

export interface AIRoutePlan {
  status: 'route_ready' | 'needs_clarification' | 'route_unavailable' | 'not_route_request';
  message: string;
  intent: RouteIntent;
  choices?: GeoPoint[];
  route?: RouteCalculateResponse;
  resolved_locations?: { origin: GeoPoint; destination: GeoPoint; waypoints: GeoPoint[] };
  navigation?: { ready: boolean };
}

export const aiRouteService = {
  async plan(message: string, currentLocation?: GeoPoint | null, context?: Record<string, unknown>): Promise<AIRoutePlan | null> {
    const vehicle = context?.selected_vehicle as {
      vehicle_type?: string;
      fuel_type?: string;
      efficiency_kmpl?: number;
      fuel_price_inr?: number;
    } | undefined;
    const response = await apiClient.post<AIRoutePlan>('/ai/route', {
      message,
      current_location: currentLocation || undefined,
      context,
      vehicle_type: vehicle?.vehicle_type || 'CAR',
      fuel_type: vehicle?.fuel_type || 'PETROL',
      fuel_efficiency_kmpl: vehicle?.efficiency_kmpl,
      fuel_price_inr: vehicle?.fuel_price_inr,
    });
    if (!response.data) {
      throw new Error(response.error || 'Unable to plan this route right now.');
    }
    return response.data;
  },
};
