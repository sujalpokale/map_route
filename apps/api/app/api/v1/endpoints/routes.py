import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any

from apps.api.app.schemas import (
    RouteCalculateRequest, RouteCalculateResponse,
    OptimizeStopsRequest, OptimizeStopsResponse, GeoPoint
)
from apps.api.app.db.session import get_db
from apps.api.app.providers.routing import get_routing_provider
from apps.api.app.providers.weather import get_weather_provider
from apps.api.app.engine.scoring import ScoringEngine
from apps.api.app.engine.vrp_optimizer import VRPOptimizer
from apps.api.app.engine.rerouter import DynamicRerouter

router = APIRouter()


@router.post("/calculate", response_model=RouteCalculateResponse)
async def calculate_routes(
    request: RouteCalculateRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Computes multiple candidate routes and scores them using the
    Intelligent Route Scoring (IRS) Engine across 9 weighted parameters.
    """
    start_time = time.time()
    routing_provider = get_routing_provider()
    weather_provider = get_weather_provider()

    # 1. Fetch routes from routing engine (vehicle-tailored)
    raw_candidates = await routing_provider.get_routes(
        origin=request.origin,
        destination=request.destination,
        waypoints=request.waypoints,
        vehicle_type=request.vehicle_type
    )

    if not raw_candidates:
        raise HTTPException(status_code=404, detail="No viable routes could be found between specified coordinates.")

    # 2. Fetch real-time weather at origin / route corridor
    weather = await weather_provider.get_weather(request.origin.lat, request.origin.lng)

    # 3. Intelligent multi-factor scoring
    evaluated_routes = ScoringEngine.evaluate_candidates(
        raw_candidates=raw_candidates,
        request=request,
        weather=weather
    )

    elapsed_ms = round((time.time() - start_time) * 1000, 2)
    best_id = evaluated_routes[0].id if evaluated_routes else ""

    return RouteCalculateResponse(
        routes=evaluated_routes,
        best_route_id=best_id,
        origin=request.origin,
        destination=request.destination,
        optimization_mode=request.optimization_mode.value,
        calculation_time_ms=elapsed_ms,
        metadata={
            "weather_condition": weather.condition,
            "temperature_c": weather.temperature_c,
            "candidates_evaluated": len(evaluated_routes),
            "scoring_strategy": request.optimization_mode.value
        }
    )


@router.post("/optimize-stops", response_model=OptimizeStopsResponse)
async def optimize_stops(request: OptimizeStopsRequest):
    """
    Solves the Vehicle Routing Problem (VRP) with priority and time windows
    to find the optimal sequence for multi-stop delivery routes.
    """
    return VRPOptimizer.optimize_delivery_sequence(request)


@router.post("/reroute")
async def evaluate_reroute(
    current_location: GeoPoint,
    destination: GeoPoint,
    current_route_id: str = "primary",
    current_eta_min: float = 35.0,
    incident_note: str = None
):
    """
    Dynamically re-evaluates route conditions mid-journey and alerts if a faster detour is available.
    """
    return await DynamicRerouter.evaluate_reroute(
        current_location=current_location,
        destination=destination,
        current_route_id=current_route_id,
        current_eta_min=current_eta_min,
        reported_incident=incident_note
    )


@router.get("/inspect-location", response_model=LocationRoadProfileResponse)
async def inspect_location(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
    address: Optional[str] = Query(None, description="Optional street address or landmark")
):
    """
    Analyzes a single location's road classification and determines accessibility
    and road suitability across Bike, Car, Van, Bus, and Truck.
    """
    from apps.api.app.providers.geocoding import get_geocoding_provider
    from apps.api.app.schemas import LocationRoadProfileResponse, VehicleAccessibilityDetail

    resolved_addr = address
    if not resolved_addr or len(resolved_addr.strip()) < 3:
        try:
            resolved_addr = await get_geocoding_provider().reverse(lat, lng)
        except Exception:
            resolved_addr = f"Location ({lat:.4f}, {lng:.4f})"

    addr_lower = (resolved_addr or "").lower()

    # Determine road type from spatial keywords & geometry
    is_highway = any(w in addr_lower for w in ["highway", "expressway", "bypass", "ring road", "nh-", "nh ", "flyover", "freight"])
    is_alley_or_narrow = any(w in addr_lower for w in ["lane", "gali", "ali", "chawl", "colony", "peth", "wadi", "nagar", "market", "bazaar", "slum", "narrow", "residential"])

    if is_highway:
        classification = "High-Capacity Freight Corridor / Expressway"
        road_width = 24.0
        speed_limit = 80
        traffic_density = "High Speed / Heavy Commercial Flow"
        best_vehicle = "TRUCK"
        summary = "Broad multi-lane freight expressway with heavy commercial transit capacity. Ideal for Trucks and Buses; 2-wheelers restricted on main carriageway."

        suitability = {
            "BIKE": VehicleAccessibilityDetail(
                suitability_score=35.0,
                status="Restricted / Caution",
                recommended_road_type="Service road only",
                guidance="High-speed vehicular traffic. 2-wheelers restricted from elevated lanes; navigate via side service lanes.",
                can_access_small_alleys=True,
                requires_clearance_m=1.2
            ),
            "CAR": VehicleAccessibilityDetail(
                suitability_score=96.0,
                status="Optimal",
                recommended_road_type="Express highway carriageway",
                guidance="High-speed vehicular transit with designated flyover & toll lanes.",
                can_access_small_alleys=False,
                requires_clearance_m=1.8
            ),
            "VAN": VehicleAccessibilityDetail(
                suitability_score=93.0,
                status="Optimal",
                recommended_road_type="Expressway & commercial ramps",
                guidance="Rapid inter-city courier distribution corridor.",
                can_access_small_alleys=False,
                requires_clearance_m=2.4
            ),
            "BUS": VehicleAccessibilityDetail(
                suitability_score=98.0,
                status="Optimal",
                recommended_road_type="Multi-lane transit corridor",
                guidance="Excellent turning radius and overhead clearance. Approved for high-capacity passenger transit.",
                can_access_small_alleys=False,
                requires_clearance_m=3.8
            ),
            "TRUCK": VehicleAccessibilityDetail(
                suitability_score=99.5,
                status="Optimal",
                recommended_road_type="Designated heavy freight bypass",
                guidance="Unrestricted axle weight and height clearance. Primary corridor for heavy logistics.",
                can_access_small_alleys=False,
                requires_clearance_m=4.5
            )
        }
    elif is_alley_or_narrow:
        classification = "Narrow Local Street / Urban Alleyway"
        road_width = 4.2
        speed_limit = 25
        traffic_density = "Dense Local Flow / Pedestrian & 2-Wheelers"
        best_vehicle = "BIKE"
        summary = "Compact residential lane/alleyway. Highly optimal for Bikes and scooters to bypass main-road gridlock; challenging or restricted for heavy vehicles."

        suitability = {
            "BIKE": VehicleAccessibilityDetail(
                suitability_score=99.5,
                status="Optimal",
                recommended_road_type="Small road, alleyway & residential shortcuts",
                guidance="Unrestricted agility. Takes small roads, pedestrian alleys, and cut-throughs with zero traffic delays.",
                can_access_small_alleys=True,
                requires_clearance_m=1.0
            ),
            "CAR": VehicleAccessibilityDetail(
                suitability_score=72.0,
                status="Feasible / Caution",
                recommended_road_type="Local residential street",
                guidance="Passable but narrow road width. Limited curbside parking and single-lane bottlenecks during peak hours.",
                can_access_small_alleys=False,
                requires_clearance_m=1.8
            ),
            "VAN": VehicleAccessibilityDetail(
                suitability_score=68.0,
                status="Caution",
                recommended_road_type="Curbside parcel access",
                guidance="Deliveries feasible with brief unloading stops. Avoid parking in bottlenecks to prevent blocking oncoming traffic.",
                can_access_small_alleys=False,
                requires_clearance_m=2.4
            ),
            "BUS": VehicleAccessibilityDetail(
                suitability_score=20.0,
                status="Restricted / Low Clearance",
                recommended_road_type="Use nearby arterial avenue",
                guidance="Not recommended for full-size buses. Tight turning corners, narrow carriageway, and overhead utility cables.",
                can_access_small_alleys=False,
                requires_clearance_m=3.6
            ),
            "TRUCK": VehicleAccessibilityDetail(
                suitability_score=15.0,
                status="Prohibited / Impassable",
                recommended_road_type="Outer freight bypass",
                guidance="Heavy commercial vehicle restriction. Inadequate turning radius and axle load limits.",
                can_access_small_alleys=False,
                requires_clearance_m=4.2
            )
        }
    else:
        classification = "Primary City Street / Arterial Avenue"
        road_width = 12.0
        speed_limit = 50
        traffic_density = "Moderate Multi-Modal Traffic"
        best_vehicle = "CAR"
        summary = "Standard multi-lane urban arterial avenue. Smooth access for Cars, Vans, and transit Buses with dedicated roadside accessibility for Bikes."

        suitability = {
            "BIKE": VehicleAccessibilityDetail(
                suitability_score=92.0,
                status="Optimal",
                recommended_road_type="Arterial roadside lane & cycleway",
                guidance="Broad visibility and good pavement. Navigate along roadside traffic flow.",
                can_access_small_alleys=True,
                requires_clearance_m=1.2
            ),
            "CAR": VehicleAccessibilityDetail(
                suitability_score=98.0,
                status="Optimal",
                recommended_road_type="Main vehicular lanes & flyovers",
                guidance="Optimal standard car road with clear lane demarcations and synchronized traffic signals.",
                can_access_small_alleys=False,
                requires_clearance_m=1.8
            ),
            "VAN": VehicleAccessibilityDetail(
                suitability_score=96.0,
                status="Optimal",
                recommended_road_type="Commercial delivery lanes",
                guidance="Excellent delivery corridor with multiple pull-in zones for courier dispatch.",
                can_access_small_alleys=False,
                requires_clearance_m=2.4
            ),
            "BUS": VehicleAccessibilityDetail(
                suitability_score=95.0,
                status="Optimal",
                recommended_road_type="Public bus transit lane",
                guidance="Standard transit corridor approved for urban transport and bus stops.",
                can_access_small_alleys=False,
                requires_clearance_m=3.8
            ),
            "TRUCK": VehicleAccessibilityDetail(
                suitability_score=80.0,
                status="Feasible (Time-Restricted)",
                recommended_road_type="Commercial arterial corridor",
                guidance="Commercial entry permitted during off-peak delivery hours; bypass recommended during rush hours.",
                can_access_small_alleys=False,
                requires_clearance_m=4.2
            )
        }

    return LocationRoadProfileResponse(
        lat=lat,
        lng=lng,
        address=resolved_addr or "Inspected Location",
        primary_road_classification=classification,
        road_width_m=road_width,
        estimated_speed_limit_kmh=speed_limit,
        traffic_density=traffic_density,
        suitability_by_vehicle=suitability,
        best_vehicle_for_location=best_vehicle,
        summary=summary
    )
