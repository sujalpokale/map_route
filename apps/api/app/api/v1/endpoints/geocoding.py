from fastapi import APIRouter, Query
from typing import List
from apps.api.app.schemas import GeoPoint
from apps.api.app.providers.geocoding import get_geocoding_provider

router = APIRouter()


@router.get("/search", response_model=List[GeoPoint])
async def search_locations(q: str = Query(..., min_length=2, description="Place search query")):
    """Searches geographic places and returns normalized lat/lng coordinates."""
    return await get_geocoding_provider().search(q, limit=6)


@router.get("/reverse")
async def reverse_geocode(lat: float = Query(...), lng: float = Query(...)):
    """Resolves latitude and longitude coordinates into a human-readable street address."""
    addr = await get_geocoding_provider().reverse(lat, lng)
    return {"address": addr, "lat": lat, "lng": lng}
