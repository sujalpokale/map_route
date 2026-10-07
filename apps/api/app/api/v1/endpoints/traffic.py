import logging

from fastapi import APIRouter, Depends, Query

from apps.api.app.providers.here import HEREProvider
from apps.api.app.providers.routing import get_routing_provider
from apps.api.app.schemas import GeoPoint, TrafficStatusResponse
from apps.api.app.services.feature_access import require_feature

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/status", response_model=TrafficStatusResponse)
async def get_traffic_status(
    _premium=Depends(require_feature("advanced_traffic")),
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
):
    location = GeoPoint(lat=lat, lng=lng)
    provider = get_routing_provider()
    if not isinstance(provider, HEREProvider):
        return TrafficStatusResponse(
            location=location,
            traffic_available=False,
            message="Live traffic is unavailable because HERE routing is not configured.",
        )
    try:
        flow = await provider.get_flow(location)
        return TrafficStatusResponse(location=location, **flow)
    except RuntimeError as exc:
        logger.warning("Traffic status unavailable: %s", str(exc))
        return TrafficStatusResponse(location=location, traffic_available=False, message=str(exc))
