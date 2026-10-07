"""HERE live traffic and traffic-aware routing provider."""
import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

from apps.api.app.core.config import settings
from apps.api.app.schemas import GeoPoint, TurnStep, VehicleTypeEnum
from apps.api.app.providers.routing import BaseRoutingProvider, RawRouteCandidate

logger = logging.getLogger(__name__)
_flow_cache: Dict[str, tuple[float, Dict[str, Any]]] = {}


def _traffic_level(jam_factor: Optional[float]) -> str:
    if jam_factor is None:
        return "Unavailable"
    if jam_factor < 2:
        return "LOW"
    if jam_factor < 5:
        return "MODERATE"
    if jam_factor < 8:
        return "HIGH"
    return "SEVERE"


def _decode_shape(encoded: str) -> List[List[float]]:
    if not encoded:
        return []
    try:
        import flexpolyline
        return [[float(lat), float(lng)] for lat, lng in flexpolyline.decode(encoded)]
    except (ImportError, ValueError, TypeError, RuntimeError):
        logger.warning("HERE route geometry could not be decoded")
        return []


class HEREProvider(BaseRoutingProvider):
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.HERE_API_KEY

    async def get_routes(
        self,
        origin: GeoPoint,
        destination: GeoPoint,
        waypoints: Optional[List[GeoPoint]] = None,
        vehicle_type: VehicleTypeEnum = VehicleTypeEnum.CAR,
        departure_time: Optional[str] = None,
        traffic_aware: bool = True,
        avoid_features: Optional[List[str]] = None,
    ) -> List[RawRouteCandidate]:
        if not self.api_key:
            raise RuntimeError("HERE_API_KEY is not configured")
        params: List[tuple[str, str]] = [
            ("apiKey", self.api_key),
            ("transportMode", "car"),
            ("origin", f"{origin.lat},{origin.lng}"),
            ("destination", f"{destination.lat},{destination.lng}"),
            ("routingMode", "fast"),
            ("alternatives", "2"),
            ("traffic[mode]", "enabled" if traffic_aware else "disabled"),
            ("return", "polyline,summary,travelSummary,actions"),
            ("departureTime", departure_time or "now"),
        ]
        for waypoint in waypoints or []:
            params.append(("via", f"{waypoint.lat},{waypoint.lng}"))
        if avoid_features:
            params.append(("avoid[features]", ",".join(avoid_features)))

        started = datetime.now(timezone.utc)
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(settings.HERE_ROUTING_URL, params=params)
                response.raise_for_status()
                data = response.json()
        except httpx.TimeoutException as exc:
            logger.warning("HERE route request timed out")
            raise RuntimeError("HERE routing timed out") from exc
        except httpx.HTTPStatusError as exc:
            logger.warning("HERE route request failed with status %s", exc.response.status_code)
            raise RuntimeError("HERE routing provider rejected the request") from exc
        except (httpx.HTTPError, ValueError) as exc:
            logger.warning("HERE route provider unavailable: %s", type(exc).__name__)
            raise RuntimeError("HERE routing provider is unavailable") from exc

        if not isinstance(data, dict):
            raise RuntimeError("HERE returned a malformed route response")
        routes = data.get("routes")
        if not isinstance(routes, list) or not routes:
            return []

        candidates: List[RawRouteCandidate] = []
        for index, route in enumerate(routes):
            if not isinstance(route, dict):
                continue
            sections = route.get("sections") or []
            section_summaries = [section.get("summary", {}) for section in sections]
            summary = route.get("summary") or {}
            length_m = summary.get("length") or sum(
                item.get("length", 0) for item in section_summaries
            )
            duration_s = summary.get("duration") or sum(
                item.get("duration", 0) for item in section_summaries
            )
            sections_with_base = [
                item for item in section_summaries
                if isinstance(item.get("baseDuration"), (int, float))
            ]
            base_duration_s = summary.get("baseDuration")
            if base_duration_s is None and sections_with_base:
                base_duration_s = sum(
                    item.get("baseDuration", item.get("duration", 0))
                    for item in section_summaries
                )
            if (
                not isinstance(length_m, (int, float)) or length_m <= 0
                or not isinstance(duration_s, (int, float)) or duration_s < 0
            ):
                continue

            delay_min = max(0.0, (duration_s - base_duration_s) / 60.0) if traffic_aware and isinstance(base_duration_s, (int, float)) else 0.0
            level = "Unavailable" if not traffic_aware or base_duration_s is None else (
                "SEVERE" if delay_min >= 15 else "HIGH" if delay_min >= 8
                else "MODERATE" if delay_min >= 3 else "LOW"
            )
            geometry: List[List[float]] = []
            steps: List[TurnStep] = []
            for section in sections:
                geometry.extend(_decode_shape(section.get("polyline", "")))
                for action in section.get("actions", []):
                    if not isinstance(action, dict):
                        continue
                    steps.append(TurnStep(
                        instruction=action.get("instruction", "Continue on route"),
                        distance_m=float(action.get("length", 0)),
                        duration_s=float(action.get("duration", 0)),
                        road_name=action.get("roadName"),
                    ))
            candidates.append(RawRouteCandidate(
                label=f"HERE route {index + 1}",
                coordinates=geometry,
                distance_km=round(length_m / 1000.0, 2),
                duration_min=round(duration_s / 60.0, 1),
                traffic_level=level,
                traffic_delay_min=round(delay_min, 1),
                road_quality="HERE route",
                steps=steps,
            ))

        elapsed_ms = (datetime.now(timezone.utc) - started).total_seconds() * 1000
        logger.info("HERE routes calculated alternatives=%d latency_ms=%.0f", len(candidates), elapsed_ms)
        return candidates

    async def get_flow(self, location: GeoPoint, radius_m: int = 1000) -> Dict[str, Any]:
        if not self.api_key:
            raise RuntimeError("HERE_API_KEY is not configured")
        cache_key = f"{location.lat:.4f}:{location.lng:.4f}:{radius_m}"
        now_monotonic = time.monotonic()
        cached = _flow_cache.get(cache_key)
        if cached and now_monotonic - cached[0] < settings.HERE_TRAFFIC_CACHE_TTL_SECONDS:
            return dict(cached[1])
        params = {
            "apiKey": self.api_key,
            "in": f"circle:{location.lat},{location.lng};r={radius_m}",
            "locationReferencing": "shape",
        }
        started = datetime.now(timezone.utc)
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.get(settings.HERE_TRAFFIC_URL, params=params)
                response.raise_for_status()
                payload = response.json()
        except httpx.TimeoutException as exc:
            logger.warning("HERE traffic request timed out")
            raise RuntimeError("HERE traffic request timed out") from exc
        except httpx.HTTPStatusError as exc:
            logger.warning("HERE traffic request failed with status %s", exc.response.status_code)
            raise RuntimeError("HERE traffic provider rejected the request") from exc
        except (httpx.HTTPError, ValueError) as exc:
            logger.warning("HERE traffic provider unavailable: %s", type(exc).__name__)
            raise RuntimeError("HERE traffic provider is unavailable") from exc

        results = payload.get("results")
        if not isinstance(results, list) or not results:
            return {"traffic_available": False, "message": "HERE returned no traffic flow for this location."}
        flows = [item.get("currentFlow", {}) for item in results if isinstance(item, dict)]
        flows = [flow for flow in flows if isinstance(flow, dict)]
        if not flows:
            return {"traffic_available": False, "message": "Traffic flow data is unavailable."}
        # A weighted aggregate is unavailable from the provider response, so use the
        # most congested reported road segment in the requested radius.
        jam_flows = [flow for flow in flows if isinstance(flow.get("jamFactor"), (int, float))]
        selected = max(jam_flows, key=lambda flow: flow["jamFactor"]) if jam_flows else flows[0]
        jam = selected.get("jamFactor")
        speed = selected.get("speed")
        free_speed = selected.get("freeFlow")
        logger.info("HERE traffic fetched latency_ms=%.0f segments=%d", (datetime.now(timezone.utc) - started).total_seconds() * 1000, len(flows))
        result = {
            "traffic_available": jam is not None or speed is not None,
            "traffic_level": _traffic_level(float(jam)) if jam is not None else "UNAVAILABLE",
            "jam_factor": jam,
            "current_speed_kph": round(float(speed) * 3.6, 1) if speed is not None else None,
            "free_flow_speed_kph": round(float(free_speed) * 3.6, 1) if free_speed is not None else None,
            "traffic_ratio": round(float(speed) / float(free_speed), 3) if speed is not None and free_speed else None,
            "confidence": selected.get("confidence"),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if result["traffic_available"]:
            if len(_flow_cache) > 512:
                expiry = now_monotonic - settings.HERE_TRAFFIC_CACHE_TTL_SECONDS
                for key in [key for key, value in _flow_cache.items() if value[0] < expiry]:
                    _flow_cache.pop(key, None)
            _flow_cache[cache_key] = (now_monotonic, result)
        return result
