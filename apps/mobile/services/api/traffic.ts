import { apiClient } from './client';
import { GeoPoint, RouteCalculateRequest, RouteCalculateResponse } from '@/types';

export interface TrafficStatus {
  location: GeoPoint;
  traffic_available: boolean;
  traffic_level: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE' | 'UNAVAILABLE';
  jam_factor: number | null;
  current_speed_kph: number | null;
  free_flow_speed_kph: number | null;
  traffic_ratio: number | null;
  updated_at: string | null;
  message?: string | null;
}

export interface RouteMatrix {
  duration_matrix_seconds: (number | null)[][];
  distance_matrix_meters: (number | null)[][];
  traffic_aware: boolean;
}

export interface RerouteSuggestion {
  reroute_available: boolean;
  recommended_route: {
    id: string;
    label: string;
    coordinates: [number, number][];
    distance_km: number;
    duration_min: number;
    traffic_delay_min: number;
    traffic_level: string;
    steps: { instruction: string; distance_m: number; duration_s: number; road_name?: string }[];
  } | null;
  current_remaining_time_minutes: number;
  alternative_time_minutes: number | null;
  time_saved_minutes: number;
  reason: string;
  traffic_available: boolean;
}

export const trafficService = {
  async getTrafficStatus(location: GeoPoint): Promise<TrafficStatus | null> {
    const response = await apiClient.get<TrafficStatus>('/traffic/status', { lat: location.lat, lng: location.lng });
    return response.data;
  },

  async calculateTrafficAwareRoute(request: RouteCalculateRequest): Promise<RouteCalculateResponse | null> {
    const response = await apiClient.post<RouteCalculateResponse>('/routes/calculate', {
      ...request,
      traffic_aware: true,
    });
    return response.data;
  },

  async calculateRouteMatrix(locations: GeoPoint[], trafficAware = true): Promise<RouteMatrix | null> {
    const response = await apiClient.post<RouteMatrix>('/routes/matrix', {
      locations,
      traffic_aware: trafficAware,
    });
    return response.data;
  },

  async requestReroute(params: {
    currentLocation: GeoPoint;
    destination: GeoPoint;
    currentRouteId: string;
    remainingRouteTimeSeconds: number;
    waypoints?: GeoPoint[];
    vehicleType?: string;
    avoidFeatures?: string[];
  }): Promise<RerouteSuggestion | null> {
    const response = await apiClient.post<RerouteSuggestion>('/routes/reroute', {
      current_location: params.currentLocation,
      destination: params.destination,
      current_route_id: params.currentRouteId,
      remaining_route_time_seconds: params.remainingRouteTimeSeconds,
      waypoints: params.waypoints || [],
      vehicle_type: params.vehicleType || 'CAR',
      avoid_features: params.avoidFeatures || [],
    });
    return response.data;
  },
};
