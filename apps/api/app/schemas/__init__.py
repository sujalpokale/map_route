from typing import List, Optional, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field


class OptimizationMode(str, Enum):
    FASTEST = "Fastest"
    SHORTEST = "Shortest"
    CHEAPEST = "Cheapest"
    FUEL_EFFICIENT = "Fuel Efficient"
    BALANCED = "Balanced"
    FLEET_OPTIMIZED = "Fleet Optimized"
    EV_OPTIMAL = "EV Optimal"
    CUSTOM = "Custom"


class VehicleTypeEnum(str, Enum):
    BIKE = "BIKE"
    CAR = "CAR"
    VAN = "VAN"
    TRUCK = "TRUCK"
    BUS = "BUS"
    EV = "EV"


class FuelTypeEnum(str, Enum):
    PETROL = "PETROL"
    DIESEL = "DIESEL"
    CNG = "CNG"
    ELECTRIC = "ELECTRIC"


class GeoPoint(BaseModel):
    lat: float = Field(..., description="Latitude coordinate")
    lng: float = Field(..., description="Longitude coordinate")
    address: Optional[str] = Field(None, description="Human readable address or place name")
    name: Optional[str] = Field(None, description="Short place name or landmark title")
    city: Optional[str] = Field(None, description="City or district")
    state: Optional[str] = Field(None, description="State or province")
    country: Optional[str] = Field(None, description="Country name")
    description: Optional[str] = Field(None, description="Custom label, note or description of the location")


class SubScores(BaseModel):
    time_score: float = Field(..., ge=0, le=100)
    fuel_score: float = Field(..., ge=0, le=100)
    cost_score: float = Field(..., ge=0, le=100)
    traffic_score: float = Field(..., ge=0, le=100)
    distance_score: float = Field(..., ge=0, le=100)
    weather_score: float = Field(..., ge=0, le=100)
    road_condition_score: float = Field(..., ge=0, le=100)
    safety_score: float = Field(..., ge=0, le=100)
    vehicle_compatibility_score: float = Field(..., ge=0, le=100)


class TurnStep(BaseModel):
    instruction: str
    distance_m: float
    duration_s: float
    road_name: Optional[str] = None
    hazard_warning: Optional[str] = None


class CandidateRoute(BaseModel):
    id: str
    label: str
    polyline: Optional[str] = None
    coordinates: List[List[float]] = Field(..., description="List of [lat, lng] points for map polyline rendering")
    distance_km: float
    duration_min: float
    eta_iso: str
    fuel_litres: float
    fuel_cost_inr: float
    toll_cost_inr: float
    driver_cost_inr: float
    maintenance_cost_inr: float
    total_cost_inr: float
    traffic_delay_min: float
    traffic_level: str = "Low"  # Low, Moderate, High, Severe
    weather_condition: str = "Clear"
    road_quality: str = "Good"
    overall_score: float
    sub_scores: SubScores
    recommendation_reason: str
    is_recommended: bool = False
    steps: Optional[List[TurnStep]] = None


class RouteCalculateRequest(BaseModel):
    origin: GeoPoint
    destination: GeoPoint
    waypoints: Optional[List[GeoPoint]] = Field(default_factory=list)
    vehicle_type: VehicleTypeEnum = VehicleTypeEnum.CAR
    fuel_type: FuelTypeEnum = FuelTypeEnum.PETROL
    fuel_efficiency_kmpl: Optional[float] = None
    payload_kg: Optional[float] = 0.0
    optimization_mode: OptimizationMode = OptimizationMode.BALANCED
    departure_time: Optional[str] = None
    custom_weights: Optional[Dict[str, float]] = None
    ev_battery_pct: Optional[float] = 100.0


class RouteCalculateResponse(BaseModel):
    routes: List[CandidateRoute]
    best_route_id: str
    origin: GeoPoint
    destination: GeoPoint
    optimization_mode: str
    calculation_time_ms: float
    metadata: Dict[str, Any] = Field(default_factory=dict)


# Multi-Stop VRP
class StopItem(BaseModel):
    id: str
    address: str
    lat: float
    lng: float
    package_weight_kg: float = 10.0
    time_window_start: Optional[str] = None  # HH:MM
    time_window_end: Optional[str] = None    # HH:MM
    priority: int = 1  # 1 (Normal), 2 (High), 3 (Urgent)


class OptimizeStopsRequest(BaseModel):
    origin: GeoPoint
    destination: Optional[GeoPoint] = None
    stops: List[StopItem]
    vehicle_type: VehicleTypeEnum = VehicleTypeEnum.VAN
    max_payload_kg: float = 1000.0
    departure_time: Optional[str] = None


class OptimizeStopsResponse(BaseModel):
    ordered_stops: List[StopItem]
    total_distance_km: float
    estimated_duration_min: float
    total_payload_kg: float
    polyline_coordinates: List[List[float]]
    summary: str
    vehicle_type: Optional[str] = "VAN"
    road_type_summary: Optional[str] = None
    road_suitability_score: Optional[float] = 95.0
    average_speed_kmh: Optional[float] = None
    vehicle_road_guidance: Optional[str] = None


# Single Location Road & Vehicle Accessibility Profile
class VehicleAccessibilityDetail(BaseModel):
    suitability_score: float = Field(..., ge=0, le=100)
    status: str  # Optimal, Feasible, Caution, Restricted
    recommended_road_type: str
    guidance: str
    can_access_small_alleys: bool
    requires_clearance_m: float


class LocationRoadProfileResponse(BaseModel):
    lat: float
    lng: float
    address: str
    primary_road_classification: str
    road_width_m: float
    estimated_speed_limit_kmh: int
    traffic_density: str
    suitability_by_vehicle: Dict[str, VehicleAccessibilityDetail]
    best_vehicle_for_location: str
    summary: str


# ML ETA & Fuel Prediction
class PredictETARequest(BaseModel):
    distance_km: float
    base_duration_min: float
    traffic_level: str = "Moderate"
    weather_condition: str = "Clear"
    road_type: str = "highway"
    hour_of_day: int = 14
    day_of_week: int = 2
    vehicle_type: str = "CAR"
    payload_kg: float = 0.0


class PredictETAResponse(BaseModel):
    predicted_duration_min: float
    confidence_interval_min: List[float]
    delay_factor: float
    model_version: str
    feature_importance: Dict[str, float]


class PredictFuelRequest(BaseModel):
    distance_km: float
    duration_min: float
    speed_kmh: float
    vehicle_type: str = "CAR"
    fuel_type: str = "PETROL"
    payload_kg: float = 0.0
    elevation_gain_m: float = 0.0
    stop_count: int = 5


class PredictFuelResponse(BaseModel):
    fuel_consumption_litres: float
    fuel_cost_inr: float
    co2_emissions_kg: float
    efficiency_kmpl: float


# AI Assistant Chat
class AIChatMessage(BaseModel):
    role: str  # user, assistant, system, tool
    content: str
    tool_calls: Optional[List[Dict[str, Any]]] = None


class AIChatRequest(BaseModel):
    message: str
    history: Optional[List[AIChatMessage]] = Field(default_factory=list)
    current_context: Optional[Dict[str, Any]] = None


class AIChatResponse(BaseModel):
    reply: str
    tool_calls_made: List[Dict[str, Any]] = Field(default_factory=list)
    suggested_action: Optional[Dict[str, Any]] = None


# OCR Location Parser
class OCRParseRequest(BaseModel):
    image_base64: Optional[str] = None
    raw_text: Optional[str] = None


class ParsedLocation(BaseModel):
    raw_extracted_text: str
    cleaned_address: str
    city: Optional[str] = None
    pincode: Optional[str] = None
    confidence_score: float
    geocoded_point: Optional[GeoPoint] = None


class OCRParseResponse(BaseModel):
    locations: List[ParsedLocation]
    status: str
    processing_time_ms: float
