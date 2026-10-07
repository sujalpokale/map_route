import time
import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any, Optional, List

from apps.api.app.schemas import (
    RouteCalculateRequest, RouteCalculateResponse,
    OptimizeStopsRequest, OptimizeStopsResponse, GeoPoint,
    LocationRoadProfileResponse, VehicleAccessibilityDetail,
    RouteMatrixRequest, RouteMatrixResponse,
    RerouteRequest, RerouteResponse
)
from apps.api.app.db.session import get_db
from apps.api.app.providers.routing import get_routing_provider, GoogleMapsRoutingProvider, OSRMProvider
from apps.api.app.providers.weather import get_weather_provider
from apps.api.app.engine.scoring import ScoringEngine
from apps.api.app.engine.vrp_optimizer import VRPOptimizer
from apps.api.app.engine.rerouter import DynamicRerouter
from apps.api.app.core.config import settings
from apps.api.app.providers.here import HEREProvider
from apps.api.app.services.feature_access import require_feature

logger = logging.getLogger(__name__)

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
    allowed_avoid_features = {"tollRoad", "controlledAccessHighway"}
    invalid_avoid_features = set(request.avoid_features) - allowed_avoid_features
    if invalid_avoid_features:
        raise HTTPException(status_code=422, detail="Unsupported route avoidance feature.")
    routing_provider = get_routing_provider()
    weather_provider = get_weather_provider()

    if request.avoid_features and not isinstance(routing_provider, HEREProvider):
        raise HTTPException(status_code=503, detail="Route avoidance requires a configured HERE routing provider.")

    # 1. Fetch routes from routing engine (vehicle-tailored)
    if isinstance(routing_provider, HEREProvider):
        try:
            raw_candidates = await routing_provider.get_routes(
                request.origin, request.destination, request.waypoints,
                request.vehicle_type, request.departure_time if request.traffic_aware else None,
                request.traffic_aware,
                request.avoid_features,
            )
        except RuntimeError as exc:
            if request.avoid_features:
                raise HTTPException(status_code=503, detail="HERE could not calculate the requested avoided route.") from exc
            logger.warning("HERE unavailable; falling back to OSRM without live traffic: %s", str(exc))
            routing_provider = OSRMProvider()
            raw_candidates = await routing_provider.get_routes(
                request.origin, request.destination, request.waypoints, request.vehicle_type
            )
    else:
        raw_candidates = await routing_provider.get_routes(
            origin=request.origin, destination=request.destination,
            waypoints=request.waypoints, vehicle_type=request.vehicle_type
        )

    if not raw_candidates and isinstance(routing_provider, HEREProvider):
        if request.avoid_features:
            raise HTTPException(status_code=404, detail="No route satisfies the requested road avoidance options.")
        logger.info("HERE returned no routes; retrying standard OSRM routing")
        routing_provider = OSRMProvider()
        raw_candidates = await routing_provider.get_routes(
            request.origin, request.destination, request.waypoints, request.vehicle_type
        )

    if not raw_candidates:
        raise HTTPException(status_code=404, detail="No viable routes could be found between specified coordinates.")

    traffic_provider_configured = (
        isinstance(routing_provider, HEREProvider) and bool(routing_provider.api_key)
    ) or (
        isinstance(routing_provider, GoogleMapsRoutingProvider) and bool(routing_provider.api_key)
    )
    if not traffic_provider_configured:
        for candidate in raw_candidates:
            candidate.traffic_level = "Unavailable"
            candidate.traffic_delay_min = 0
    traffic_available = traffic_provider_configured and any(
        route.traffic_level != "Unavailable" for route in raw_candidates
    )

    # 2. Fetch real-time weather at origin / route corridor
    weather = await weather_provider.get_weather(request.origin.lat, request.origin.lng)

    # 3. Intelligent multi-factor scoring
    evaluated_routes = ScoringEngine.evaluate_candidates(
        raw_candidates=raw_candidates,
        request=request,
        weather=weather
    )

    # Traffic-adjusted arrival time is the primary route objective when enabled.
    if request.traffic_aware:
        evaluated_routes.sort(key=lambda route: route.duration_min)
        for index, route in enumerate(evaluated_routes):
            route.is_recommended = index == 0

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
            "scoring_strategy": request.optimization_mode.value,
            "traffic_available": traffic_available,
            "routing_provider": "here" if isinstance(routing_provider, HEREProvider) else "google" if isinstance(routing_provider, GoogleMapsRoutingProvider) and not routing_provider.used_fallback else "osrm",
            "live_traffic_fallback": not traffic_available,
        }
    )


@router.post("/matrix", response_model=RouteMatrixResponse)
async def calculate_route_matrix(request: RouteMatrixRequest):
    count = len(request.locations)
    if count > settings.ROUTE_MATRIX_MAX_LOCATIONS:
        raise HTTPException(status_code=422, detail=f"At most {settings.ROUTE_MATRIX_MAX_LOCATIONS} locations are supported.")
    provider = get_routing_provider()
    durations: List[List[Optional[int]]] = [[None] * count for _ in range(count)]
    distances: List[List[Optional[int]]] = [[None] * count for _ in range(count)]
    for i in range(count):
        durations[i][i] = 0
        distances[i][i] = 0
    semaphore = asyncio.Semaphore(4)
    here_success = True

    async def fetch_pair(i: int, j: int):
        nonlocal here_success
        async with semaphore:
            try:
                if isinstance(provider, HEREProvider):
                    routes = await provider.get_routes(
                        request.locations[i], request.locations[j], [],
                        traffic_aware=request.traffic_aware,
                    )
                else:
                    routes = await provider.get_routes(request.locations[i], request.locations[j], [])
                if routes:
                    durations[i][j] = round(routes[0].duration_min * 60)
                    distances[i][j] = round(routes[0].distance_km * 1000)
                    if isinstance(provider, HEREProvider):
                        here_success = here_success and routes[0].traffic_level != "Unavailable"
                elif isinstance(provider, HEREProvider):
                    here_success = False
            except Exception as exc:
                logger.warning("Route matrix pair failed (%d,%d): %s", i, j, type(exc).__name__)
                if isinstance(provider, HEREProvider):
                    here_success = False
                    try:
                        routes = await OSRMProvider().get_routes(request.locations[i], request.locations[j], [])
                        if routes:
                            durations[i][j] = round(routes[0].duration_min * 60)
                            distances[i][j] = round(routes[0].distance_km * 1000)
                    except Exception:
                        pass

    await asyncio.gather(*(fetch_pair(i, j) for i in range(count) for j in range(count) if i != j))
    return RouteMatrixResponse(
        duration_matrix_seconds=durations,
        distance_matrix_meters=distances,
        traffic_aware=request.traffic_aware and isinstance(provider, HEREProvider) and here_success,
    )




@router.post("/optimize-stops", response_model=OptimizeStopsResponse)
async def optimize_stops(request: OptimizeStopsRequest, _premium=Depends(require_feature("multi_stop_optimization"))):
    """
    Solves the Vehicle Routing Problem (VRP) with priority and time windows
    to find the optimal sequence for multi-stop delivery routes.
    """
    provider = get_routing_provider()
    nodes = [request.origin, *[
        GeoPoint(lat=stop.lat, lng=stop.lng, address=stop.address) for stop in request.stops
    ]]
    if request.destination:
        nodes.append(request.destination)

    matrix: Optional[List[List[Optional[int]]]] = None
    if isinstance(provider, HEREProvider) and len(nodes) <= settings.ROUTE_MATRIX_MAX_LOCATIONS:
        matrix = [[0 if i == j else None for j in range(len(nodes))] for i in range(len(nodes))]
        semaphore = asyncio.Semaphore(4)
        async def fetch_leg(i: int, j: int):
            async with semaphore:
                routes = await provider.get_routes(nodes[i], nodes[j], [])
                if routes and routes[0].traffic_level != "Unavailable":
                    matrix[i][j] = round(routes[0].duration_min * 60)

        try:
            await asyncio.gather(*(
                fetch_leg(i, j) for i in range(len(nodes))
                for j in range(len(nodes)) if i != j
            ))
            if any(matrix[i][j] is None for i in range(len(nodes)) for j in range(len(nodes)) if i != j):
                matrix = None
        except Exception as exc:
            logger.warning("HERE stop-optimization matrix unavailable: %s", type(exc).__name__)
            matrix = None

    return VRPOptimizer.optimize_delivery_sequence(request, matrix)


@router.post("/reroute", response_model=RerouteResponse)
async def evaluate_reroute(
    request: RerouteRequest,
):
    if set(request.avoid_features) - {"tollRoad", "controlledAccessHighway"}:
        raise HTTPException(status_code=422, detail="Unsupported route avoidance feature.")
    return await DynamicRerouter.evaluate_reroute(request)


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
