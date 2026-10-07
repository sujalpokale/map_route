import pytest
import httpx

from apps.api.app.providers.here import HEREProvider, _traffic_level
from apps.api.app.schemas import GeoPoint
from apps.api.app.engine.vrp_optimizer import VRPOptimizer
from apps.api.app.schemas import StopItem


def test_here_traffic_levels_use_provider_jam_factor():
    assert _traffic_level(0.5) == "LOW"
    assert _traffic_level(3.0) == "MODERATE"
    assert _traffic_level(6.0) == "HIGH"
    assert _traffic_level(9.0) == "SEVERE"
    assert _traffic_level(None) == "Unavailable"


@pytest.mark.asyncio
async def test_here_route_alternatives_use_live_and_base_durations(monkeypatch):
    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return {"routes": [
                {"sections": [{"polyline": "", "actions": [],
                                "summary": {"length": 18000, "duration": 2400, "baseDuration": 1800}}]},
                {"sections": [{"polyline": "", "actions": [],
                                "summary": {"length": 19500, "duration": 2100, "baseDuration": 2040}}]},
            ]}

    class Client:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def get(self, url, params):
            assert params[0] == ("apiKey", "test-key")
            return Response()

    monkeypatch.setattr("httpx.AsyncClient", Client)
    provider = HEREProvider(api_key="test-key")
    routes = await provider.get_routes(
        GeoPoint(lat=18.5, lng=73.8), GeoPoint(lat=18.6, lng=73.9)
    )
    assert len(routes) == 2
    assert routes[0].duration_min == 40
    assert routes[0].traffic_delay_min == 10
    assert routes[0].traffic_level == "HIGH"
    assert routes[1].distance_km == 19.5


@pytest.mark.asyncio
async def test_here_flow_converts_provider_speeds_to_kph(monkeypatch):
    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return {"results": [{"currentFlow": {
                "speed": 10,
                "freeFlow": 20,
                "jamFactor": 7.2,
                "confidence": 0.85,
            }}]}

    calls = 0

    class Client:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def get(self, url, params):
            nonlocal calls
            calls += 1
            return Response()

    monkeypatch.setattr("httpx.AsyncClient", Client)
    monkeypatch.setattr("apps.api.app.providers.here._flow_cache", {})
    result = await HEREProvider(api_key="test-key").get_flow(GeoPoint(lat=18.5, lng=73.8))
    cached = await HEREProvider(api_key="test-key").get_flow(GeoPoint(lat=18.5, lng=73.8))
    assert result["traffic_level"] == "HIGH"
    assert result["current_speed_kph"] == 36
    assert result["free_flow_speed_kph"] == 72
    assert result["traffic_ratio"] == 0.5
    assert result["confidence"] == 0.85
    assert cached == result
    assert calls == 1


@pytest.mark.asyncio
async def test_here_rejects_invalid_api_key_without_exposing_it(monkeypatch):
    class Response:
        def raise_for_status(self):
            request = httpx.Request("GET", "https://router.hereapi.com/v8/routes")
            raise httpx.HTTPStatusError("unauthorized", request=request, response=httpx.Response(401, request=request))

    class Client:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def get(self, url, params):
            return Response()

    monkeypatch.setattr("httpx.AsyncClient", Client)
    with pytest.raises(RuntimeError, match="rejected"):
        await HEREProvider(api_key="secret-test-value").get_routes(
            GeoPoint(lat=18.5, lng=73.8), GeoPoint(lat=18.6, lng=73.9)
        )


def test_two_opt_uses_traffic_time_matrix_when_provided():
    nodes = [
        StopItem(id="origin", address="Origin", lat=0, lng=0),
        StopItem(id="a", address="A", lat=0, lng=1),
        StopItem(id="b", address="B", lat=1, lng=0),
    ]
    matrix = [
        [0, 10, 20, 50],
        [20, 0, 100, 20],
        [10, 10, 0, 10],
        [0, 0, 0, 0],
    ]
    result = VRPOptimizer._two_opt_open_path([0, 1, 2], nodes, matrix, 3)
    assert result == [0, 2, 1]
