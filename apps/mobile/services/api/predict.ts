import { apiClient } from './client';

export interface PredictETAParams {
  distance_km: number;
  base_duration_min: number;
  traffic_level?: string;
  weather_condition?: string;
  road_type?: string;
  hour_of_day?: number;
  day_of_week?: number;
  vehicle_type?: string;
  payload_kg?: number;
}

export interface PredictETAResult {
  predicted_duration_min: number;
  confidence_interval_min: [number, number];
  delay_factor: number;
  model_version: string;
  feature_importance: Record<string, number>;
}

export interface PredictFuelParams {
  distance_km: number;
  duration_min: number;
  speed_kmh: number;
  vehicle_type?: string;
  fuel_type?: string;
  payload_kg?: number;
  elevation_gain_m?: number;
  stop_count?: number;
}

export interface PredictFuelResult {
  fuel_consumption_litres: number;
  fuel_cost_inr: number;
  co2_emissions_kg: number;
  efficiency_kmpl: number;
}

export const predictService = {
  async predictETA(params: PredictETAParams): Promise<PredictETAResult | null> {
    const response = await apiClient.post<PredictETAResult>('/predict/eta', params);
    return response.data;
  },

  async predictFuel(params: PredictFuelParams): Promise<PredictFuelResult | null> {
    const response = await apiClient.post<PredictFuelResult>('/predict/fuel', params);
    return response.data;
  },
};
