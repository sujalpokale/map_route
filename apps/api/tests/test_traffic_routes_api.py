import pytest

from apps.api.app.api.v1.endpoints import routes as routes_api
from apps.api.app.providers.routing import RawRouteCandidate
from apps.api.app.providers.weather import WeatherData
from apps.api.app.schemas import GeoPoint, RouteCalculateRequest


@pytest.mark.asyncio
async def test_non_traffic_provider_is_explicitly_marked_unavailable(monkeypatch):
    class Provider:
        async def get_routes(self, **kwargs):
            return [RawRouteCandidate(
                label="OSRM path",
                coordinates=[[18.5, 73.8], [18.6, 73.9]],
                distance_km=12,
                duration_min=25,
                traffic_level="High",
                traffic_delay_min=9,
            )]

    class WeatherProvider:
        async def get_weather(self, lat, lng):
            return WeatherData("Clear", 25, 0, 2, 10, 90)

    monkeypatch.setattr(routes_api, "get_routing_provider", lambda: Provider())
    monkeypatch.setattr(routes_api, "get_weather_provider", lambda: WeatherProvider())
    request = RouteCalculateRequest(
        origin=GeoPoint(lat=18.5, lng=73.8),
        destination=GeoPoint(lat=18.6, lng=73.9),
    )

    response = await routes_api.calculate_routes(request, db=None)
    assert response.metadata["traffic_available"] is False
    assert response.metadata["live_traffic_fallback"] is True
    assert response.routes[0].traffic_level == "Unavailable"
    assert response.routes[0].traffic_delay_min == 0
