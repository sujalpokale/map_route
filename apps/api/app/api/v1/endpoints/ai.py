import logging
import math
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from apps.api.app.schemas import AIChatRequest, AIChatResponse, FuelTypeEnum, GeoPoint, RouteCalculateRequest
from apps.api.app.engine.ai_agent import AIAssistantAgent
from apps.api.app.engine.route_intent import LocalRouteAIProvider, get_route_ai_provider
from apps.api.app.providers.geocoding import get_geocoding_provider
from apps.api.app.api.v1.endpoints.routes import calculate_routes
from apps.api.app.services.feature_access import has_feature, require_limited_route_planning

logger = logging.getLogger(__name__)

router = APIRouter()


class AIRouteRequest(BaseModel):
    message: str = Field(..., min_length=2, max_length=1000)
    current_location: Optional[GeoPoint] = None
    context: Optional[Dict[str, Any]] = None
    vehicle_type: str = "CAR"
    fuel_type: FuelTypeEnum = FuelTypeEnum.PETROL
    fuel_efficiency_kmpl: Optional[float] = Field(default=None, gt=0, le=500)
    fuel_price_inr: Optional[float] = Field(default=None, gt=0, le=10000)


def _far_apart(a: GeoPoint, b: GeoPoint) -> bool:
    lat1, lat2 = math.radians(a.lat), math.radians(b.lat)
    dlat = lat2 - lat1
    dlng = math.radians(b.lng - a.lng)
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 6371000 * 2 * math.atan2(math.sqrt(h), math.sqrt(max(0, 1 - h))) > 5000


async def _resolve_place(query: str) -> tuple[Optional[GeoPoint], List[GeoPoint]]:
    points = await get_geocoding_provider().search(query, limit=5)
    points = [point for point in points if 6.5 <= point.lat <= 37.5 and 68 <= point.lng <= 97.5]
    if not points:
        return None, []
    if len(points) > 1 and any(_far_apart(points[0], point) for point in points[1:]):
        return None, points
    return points[0], []


@router.post("/route")
async def plan_natural_language_route(request: AIRouteRequest, _user=Depends(require_limited_route_planning)) -> Dict[str, Any]:
    """Parse language, resolve places, then use the existing routing engine."""
    try:
        intent = await get_route_ai_provider().parse_route_request(request.message, request.context)
    except Exception as exc:
        logger.warning("Route intent provider failed; using deterministic parser (%s)", type(exc).__name__)
        intent = await LocalRouteAIProvider().parse_route_request(request.message, request.context)

    intent_data = intent.model_dump()
    if not intent.destination and not intent.waypoints:
        route_terms = ("route", "take me", "go to", "navigate", "visit", "destination", "from ")
        if any(term in request.message.lower() for term in route_terms):
            return {
                "status": "needs_clarification",
                "message": "Tell me the destination, or list the places you want to visit.",
                "intent": intent_data,
            }
        return {"status": "not_route_request", "message": "I couldn't identify a route request.", "intent": intent_data}

    origin = request.current_location if intent.use_current_location else None
    if not intent.use_current_location and intent.origin:
        origin, ambiguous = await _resolve_place(intent.origin)
        if ambiguous:
            choices = [p.model_dump() for p in ambiguous]
            labels = "; ".join(point.address or point.name or f"{point.lat:.4f}, {point.lng:.4f}" for point in ambiguous)
            return {"status": "needs_clarification", "message": f"Which starting location did you mean? {labels}", "choices": choices, "intent": intent_data}
        if not origin:
            return {"status": "needs_clarification", "message": f"I couldn't find the starting location '{intent.origin}'. Please clarify it.", "intent": intent_data}
    if origin is None:
        return {"status": "needs_clarification", "message": "Share your current location or specify a starting place.", "intent": intent_data}

    destination: Optional[GeoPoint] = None
    waypoint_points: List[GeoPoint] = []
    if intent.destination:
        point, ambiguous = await _resolve_place(intent.destination)
        if ambiguous:
            choices = [p.model_dump() for p in ambiguous]
            labels = "; ".join(point.address or point.name or f"{point.lat:.4f}, {point.lng:.4f}" for point in ambiguous)
            return {"status": "needs_clarification", "message": f"Which '{intent.destination}' did you mean? {labels}", "choices": choices, "intent": intent_data}
        if not point:
            return {"status": "needs_clarification", "message": f"I couldn't confidently locate '{intent.destination}'. Please add its city or area.", "intent": intent_data}
        destination = point

    for place in intent.waypoints:
        point, ambiguous = await _resolve_place(place)
        if ambiguous:
            choices = [p.model_dump() for p in ambiguous]
            labels = "; ".join(point.address or point.name or f"{point.lat:.4f}, {point.lng:.4f}" for point in ambiguous)
            return {"status": "needs_clarification", "message": f"Which '{place}' did you mean? {labels}", "choices": choices, "intent": intent_data}
        if not point:
            return {"status": "needs_clarification", "message": f"I couldn't confidently locate '{place}'. Please add its city or area.", "intent": intent_data}
        waypoint_points.append(point)

    if not destination and waypoint_points:
        # Stop ordering is delegated to the existing route-matrix/VRP optimizer.
        from apps.api.app.api.v1.endpoints.routes import calculate_route_matrix
        from apps.api.app.engine.vrp_optimizer import VRPOptimizer
        from apps.api.app.schemas import OptimizeStopsRequest, RouteMatrixRequest, StopItem
        matrix = await calculate_route_matrix(RouteMatrixRequest(locations=[origin, *waypoint_points], traffic_aware=intent.traffic_aware))
        matrix_size = len(matrix.duration_matrix_seconds)
        if any(
            matrix.duration_matrix_seconds[i][j] is None
            for i in range(matrix_size) for j in range(matrix_size) if i != j
        ):
            return {"status": "route_unavailable", "message": "I could not build a complete road travel-time matrix for these stops, so I won't claim an optimized order.", "intent": intent_data}
        optimized = VRPOptimizer.optimize_delivery_sequence(
            OptimizeStopsRequest(
                origin=origin,
                stops=[StopItem(id=str(i), address=p.address or p.name or intent.waypoints[i], lat=p.lat, lng=p.lng) for i, p in enumerate(waypoint_points)],
                vehicle_type=request.vehicle_type,
            ),
            matrix.duration_matrix_seconds,
        )
        ordered = optimized.ordered_stops
        if ordered:
            destination = GeoPoint(lat=ordered[-1].lat, lng=ordered[-1].lng, address=ordered[-1].address)
            waypoint_points = [GeoPoint(lat=stop.lat, lng=stop.lng, address=stop.address) for stop in ordered[:-1]]
            intent_data["waypoints"] = [stop.address for stop in ordered[:-1]]

    if not destination:
        return {"status": "needs_clarification", "message": "Please provide a destination.", "intent": intent_data}

    avoid_features = intent.avoid
    route_request = RouteCalculateRequest(
        origin=origin,
        destination=destination,
        waypoints=waypoint_points,
        vehicle_type=request.vehicle_type,
        fuel_type=request.fuel_type,
        fuel_efficiency_kmpl=request.fuel_efficiency_kmpl,
        fuel_price_inr=request.fuel_price_inr,
        optimization_mode={"shortest": "Shortest", "cheapest": "Cheapest", "fuel_efficient": "Fuel Efficient", "optimized": "Balanced"}.get(intent.route_preference, "Fastest"),
        traffic_aware=intent.traffic_aware,
        avoid_features=avoid_features,
    )
    try:
        route = await calculate_routes(route_request, None)
    except Exception as exc:
        detail = getattr(exc, "detail", None) or "The routing provider could not calculate this journey."
        return {"status": "route_unavailable", "message": str(detail), "intent": intent_data}

    intent_data["origin"] = origin.address or origin.name or intent.origin
    intent_data["destination"] = destination.address or destination.name or intent.destination
    return {
        "status": "route_ready",
        "message": "Route calculated from geocoded locations and current routing data.",
        "intent": intent_data,
        "route": route.model_dump(mode="json"),
        "resolved_locations": {
            "origin": origin.model_dump(),
            "destination": destination.model_dump(),
            "waypoints": [point.model_dump() for point in waypoint_points],
        },
        "navigation": {"ready": bool(route.routes and route.routes[0].coordinates)},
    }


@router.post("/chat", response_model=AIChatResponse)
async def chat_with_assistant(request: AIChatRequest, user=Depends(require_limited_route_planning)):
    """
    Conversational AI Transportation Assistant with grounded tool calling.
    Answers route questions, compares alternatives, computes costs, and triggers optimizations.
    """
    history_dicts = [{"role": m.role, "content": m.content} for m in (request.history or [])]
    result = await AIAssistantAgent.process_user_query(
        message=request.message,
        history=history_dicts,
        context=request.current_context,
        allow_external=await has_feature(user["user_id"], "ai_route_assistant"),
    )

    return AIChatResponse(
        reply=result["reply"],
        tool_calls_made=result.get("tool_calls_made", []),
        suggested_action=result.get("suggested_action")
    )
