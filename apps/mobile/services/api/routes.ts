import { apiClient } from './client';
import {
  RouteCalculateRequest,
  RouteCalculateResponse,
  OptimizeStopsRequest,
  OptimizeStopsResponse,
  GeoPoint,
} from '@/types';

export const routeService = {
  async calculate(request: RouteCalculateRequest): Promise<RouteCalculateResponse | null> {
    try {
      const response = await apiClient.post<RouteCalculateResponse>('/routes/calculate', request);
      if (response.error || !response.data) {
        return null;
      }
      return response.data;
    } catch {
      return null;
    }
  },

  async optimizeStops(request: OptimizeStopsRequest): Promise<OptimizeStopsResponse | null> {
    try {
      const response = await apiClient.post<OptimizeStopsResponse>('/routes/optimize-stops', request);
      if (response.error || !response.data) {
        return null;
      }
      return response.data;
    } catch {
      return null;
    }
  },

  async evaluateReroute(params: {
    currentLocation: GeoPoint;
    destination: GeoPoint;
    currentRouteId?: string;
    currentEtaMin?: number;
    incidentNote?: string;
  }) {
    try {
      const response = await apiClient.post<any>('/routes/reroute', {
        current_location: params.currentLocation,
        destination: params.destination,
        current_route_id: params.currentRouteId || 'primary',
        current_eta_min: params.currentEtaMin || 35.0,
        incident_note: params.incidentNote,
      });
      return response.data;
    } catch {
      return null;
    }
  },
};
