import logging
import time
from typing import Any, Dict

from apps.api.app.core.config import settings
from apps.api.app.providers.here import HEREProvider
from apps.api.app.providers.routing import GoogleMapsRoutingProvider, OSRMProvider, get_routing_provider
from apps.api.app.schemas import RerouteRequest

logger = logging.getLogger(__name__)
_last_reroute_at: Dict[str, float] = {}


class DynamicRerouter:
    @classmethod
    async def evaluate_reroute(cls, request: RerouteRequest) -> Dict[str, Any]:
        provider = get_routing_provider()
        if request.avoid_features and not isinstance(provider, HEREProvider):
            return {
                "reroute_available": False,
                "recommended_route": None,
                "current_remaining_time_minutes": round(request.remaining_route_time_seconds / 60, 1),
                "alternative_time_minutes": None,
                "time_saved_minutes": 0,
                "reason": "The configured routing provider cannot honor the requested road avoidances.",
                "traffic_available": False,
            }
        try:
            routes = await provider.get_routes(
                request.current_location,
                request.destination,
                request.waypoints,
                request.vehicle_type,
                avoid_features=request.avoid_features if isinstance(provider, HEREProvider) else None,
            )
        except RuntimeError as exc:
            if request.avoid_features:
                logger.warning("HERE reroute failed while applying road avoidance: %s", type(exc).__name__)
                routes = []
            else:
                logger.warning("Reroute traffic provider unavailable; using OSRM: %s", str(exc))
                provider = OSRMProvider()
                routes = await provider.get_routes(
                    request.current_location, request.destination, request.waypoints,
                    request.vehicle_type,
                )
        if not isinstance(provider, (HEREProvider, GoogleMapsRoutingProvider)):
            for route in routes:
                route.traffic_level = "Unavailable"
                route.traffic_delay_min = 0
        traffic_available = any(route.traffic_level != "Unavailable" for route in routes)
        if not routes:
            return {
                "reroute_available": False,
                "recommended_route": None,
                "current_remaining_time_minutes": round(request.remaining_route_time_seconds / 60, 1),
                "alternative_time_minutes": None,
                "time_saved_minutes": 0,
                "reason": "No alternative route is currently available.",
                "traffic_available": traffic_available,
            }

        fastest = min(routes, key=lambda route: route.duration_min)
        current_minutes = request.remaining_route_time_seconds / 60
        saved = current_minutes - fastest.duration_min
        improvement = (saved / current_minutes * 100) if current_minutes > 0 else 0
        key = f"{request.current_route_id}:{request.destination.lat:.4f}:{request.destination.lng:.4f}"
        now = time.monotonic()
        last = _last_reroute_at.get(key, 0)
        on_cooldown = now - last < settings.REROUTE_COOLDOWN_SECONDS
        qualifies = (
            saved >= settings.REROUTE_MIN_TIME_SAVING_MINUTES
            and improvement >= settings.REROUTE_MIN_PERCENT_IMPROVEMENT
            and not on_cooldown
        )
        if qualifies:
            _last_reroute_at[key] = now

        reason = "A faster route meets the configured time-saving thresholds." if qualifies else (
            "Reroute cooldown is active." if on_cooldown else "The time improvement is below the reroute threshold."
        )
        logger.info(
            "reroute evaluated available=%s saved_min=%.1f improvement_pct=%.1f cooldown=%s",
            qualifies, saved, improvement, on_cooldown,
        )
        route_data = {
            "id": f"reroute_{request.current_route_id}_{int(now)}",
            "label": fastest.label,
            "coordinates": fastest.coordinates,
            "distance_km": fastest.distance_km,
            "duration_min": fastest.duration_min,
            "traffic_delay_min": fastest.traffic_delay_min,
            "traffic_level": fastest.traffic_level,
            "steps": [step.model_dump() if hasattr(step, "model_dump") else step for step in fastest.steps],
        }
        return {
            "reroute_available": qualifies,
            "recommended_route": route_data if qualifies else None,
            "current_remaining_time_minutes": round(current_minutes, 1),
            "alternative_time_minutes": fastest.duration_min,
            "time_saved_minutes": round(max(0, saved), 1),
            "reason": reason,
            "traffic_available": traffic_available,
        }
