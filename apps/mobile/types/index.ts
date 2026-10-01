export type OptimizationMode =
  | 'Fastest'
  | 'Shortest'
  | 'Cheapest'
  | 'Fuel Efficient'
  | 'Balanced'
  | 'Fleet Optimized'
  | 'EV Optimal'
  | 'Custom';

export type VehicleType = 'BIKE' | 'CAR' | 'VAN' | 'TRUCK' | 'BUS' | 'EV';
export type FuelType = 'PETROL' | 'DIESEL' | 'CNG' | 'ELECTRIC';
export type UserRole = 'USER' | 'DRIVER' | 'FLEET_MANAGER' | 'ADMIN';
export type DeliveryPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type DeliveryStatus = 'PENDING' | 'EN_ROUTE' | 'ARRIVED' | 'COMPLETED' | 'FAILED' | 'RESCHEDULED';

export interface GeoPoint {
  lat: number;
  lng: number;
  address?: string;
  name?: string;
  city?: string;
  state?: string;
  country?: string;
  description?: string;
}

export interface SubScores {
  time_score: number;
  fuel_score: number;
  cost_score: number;
  traffic_score: number;
  distance_score: number;
  weather_score: number;
  road_condition_score: number;
  safety_score: number;
  vehicle_compatibility_score: number;
}

export interface TurnStep {
  instruction: string;
  distance_m: number;
  duration_s: number;
  road_name?: string;
  hazard_warning?: string;
}

export interface CandidateRoute {
  id: string;
  label: string;
  polyline?: string;
  coordinates: [number, number][]; // [lat, lng]
  distance_km: number;
  duration_min: number;
  eta_iso: string;
  fuel_litres: number;
  fuel_cost_inr: number;
  toll_cost_inr: number;
  driver_cost_inr: number;
  maintenance_cost_inr: number;
  total_cost_inr: number;
  traffic_delay_min: number;
  traffic_level: 'Low' | 'Moderate' | 'High' | 'Severe';
  weather_condition: string;
  road_quality: string;
  overall_score: number;
  sub_scores: SubScores;
  recommendation_reason: string;
  is_recommended?: boolean;
  steps?: TurnStep[];
}

export interface RouteCalculateRequest {
  origin: GeoPoint;
  destination: GeoPoint;
  waypoints?: GeoPoint[];
  vehicle_type?: VehicleType;
  fuel_type?: FuelType;
  fuel_efficiency_kmpl?: number;
  payload_kg?: number;
  optimization_mode?: OptimizationMode;
  departure_time?: string;
  custom_weights?: Record<string, number>;
  ev_battery_pct?: number;
}

export interface RouteCalculateResponse {
  routes: CandidateRoute[];
  best_route_id: string;
  origin: GeoPoint;
  destination: GeoPoint;
  optimization_mode: string;
  calculation_time_ms: number;
  metadata?: Record<string, any>;
}

export interface StopItem {
  id: string;
  name?: string;
  address: string;
  lat: number;
  lng: number;
  package_weight_kg?: number;
  time_window_start?: string; // HH:MM
  time_window_end?: string;   // HH:MM
  priority: number; // 1 (Normal), 2 (High), 3 (Urgent)
  is_locked?: boolean;
  recipient_name?: string;
  recipient_phone?: string;
  status?: DeliveryStatus;
  notes?: string;
}

export interface OptimizeStopsRequest {
  origin: GeoPoint;
  destination?: GeoPoint;
  stops: StopItem[];
  vehicle_type?: VehicleType;
  max_payload_kg?: number;
  departure_time?: string;
}

export interface OptimizeStopsResponse {
  ordered_stops: StopItem[];
  total_distance_km: number;
  estimated_duration_min: number;
  total_payload_kg: number;
  polyline_coordinates: [number, number][];
  summary: string;
}

export interface GPSLocation {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  timestamp: number;
}

export interface DeviationCheck {
  is_deviated: boolean;
  distance_from_route_m: number;
  recommended_action: 'CONTINUE' | 'RECALCULATE' | 'U_TURN';
  faster_detour_available?: boolean;
  time_saved_min?: number;
}

export interface VehicleProfile {
  id: string;
  name: string;
  vehicle_type: VehicleType;
  fuel_type: FuelType;
  license_plate: string;
  efficiency_kmpl: number;
  fuel_price_inr: number;
  curb_weight_kg: number;
  max_payload_kg: number;
  ev_battery_capacity_kwh?: number;
  ev_current_battery_pct?: number;
  ev_range_km?: number;
  is_default?: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  avatar_url?: string;
  organization?: string;
  total_trips: number;
  total_distance_km: number;
  total_fuel_saved_litres: number;
}

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  tool_calls?: {
    tool: string;
    parameters: Record<string, any>;
    result?: any;
  }[];
  suggested_action?: {
    type: 'NAVIGATE' | 'SELECT_ROUTE' | 'OPTIMIZE_STOPS' | 'ADD_STOP';
    payload: any;
  };
}

export interface TripRecord {
  id: string;
  route_id?: string;
  start_time: string;
  end_time?: string;
  origin_name: string;
  destination_name: string;
  distance_km: number;
  duration_min: number;
  planned_duration_min: number;
  fuel_litres: number;
  fuel_cost_inr: number;
  score: number;
  stops_completed: number;
  co2_saved_kg: number;
  telematics_points?: [number, number][];
}

export interface AppSettings {
  units: 'metric' | 'imperial';
  currency: 'INR' | 'USD' | 'EUR';
  defaultOptimization: OptimizationMode;
  autoRerouteThresholdMin: number;
  voiceGuidanceEnabled: boolean;
  darkMapEnabled: boolean;
  telematicsSyncIntervalSec: number;
  hapticFeedbackEnabled: boolean;
}
