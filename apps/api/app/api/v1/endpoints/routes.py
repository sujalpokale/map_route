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
