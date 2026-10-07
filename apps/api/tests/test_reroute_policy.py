from types import SimpleNamespace

import pytest

from apps.api.app.engine.rerouter import DynamicRerouter
from apps.api.app.schemas import GeoPoint, RerouteRequest
from apps.api.app.core.config import settings


class StubProvider:
    def __init__(self, duration_min):
        self.duration_min = duration_min

    async def get_routes(self, *args, **kwargs):
        return [SimpleNamespace(
            label="fast route",
            duration_min=self.duration_min,
            distance_km=10.0,
            coordinates=[],
            traffic_delay_min=0,
            traffic_level="Unavailable",
            steps=[],
        )]


def _request(route_id, remaining_seconds):
    return RerouteRequest(
        current_location=GeoPoint(lat=18.5, lng=73.8),
        destination=GeoPoint(lat=18.6, lng=73.9),
        current_route_id=route_id,
        remaining_route_time_seconds=remaining_seconds,
    )


@pytest.mark.asyncio
async def test_reroute_is_offered_for_meaningful_time_saving(monkeypatch):
    monkeypatch.setattr(settings, "REROUTE_MIN_TIME_SAVING_MINUTES", 5)
    monkeypatch.setattr(settings, "REROUTE_MIN_PERCENT_IMPROVEMENT", 10)
    monkeypatch.setattr(settings, "REROUTE_COOLDOWN_SECONDS", 300)
    monkeypatch.setattr("apps.api.app.engine.rerouter.get_routing_provider", lambda: StubProvider(30))
    result = await DynamicRerouter.evaluate_reroute(_request("meaningful-test", 6000))
    assert result["reroute_available"] is True
    assert result["time_saved_minutes"] == 70
    repeated = await DynamicRerouter.evaluate_reroute(_request("meaningful-test", 6000))
    assert repeated["reroute_available"] is False
    assert repeated["reason"] == "Reroute cooldown is active."


@pytest.mark.asyncio
async def test_small_improvement_does_not_reroute(monkeypatch):
    monkeypatch.setattr(settings, "REROUTE_MIN_TIME_SAVING_MINUTES", 5)
    monkeypatch.setattr(settings, "REROUTE_MIN_PERCENT_IMPROVEMENT", 10)
    monkeypatch.setattr("apps.api.app.engine.rerouter.get_routing_provider", lambda: StubProvider(30))
    result = await DynamicRerouter.evaluate_reroute(_request("small-test", 2000))
    assert result["reroute_available"] is False
    assert result["recommended_route"] is None
