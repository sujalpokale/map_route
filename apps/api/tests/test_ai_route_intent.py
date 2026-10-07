import pytest
from fastapi.testclient import TestClient

from apps.api.app.engine.route_intent import LocalRouteAIProvider
from apps.api.app.main import app
from apps.api.app.services.feature_access import require_limited_route_planning
from apps.api.app.api.v1.endpoints import ai as ai_endpoint

client = TestClient(app)


@pytest.mark.asyncio
async def test_parse_explicit_origin_and_destination():
    intent = await LocalRouteAIProvider().parse_route_request(
        "Find the fastest route from Kothrud to Pune Airport"
    )
    assert intent.origin == "Kothrud"
    assert intent.destination == "Pune Airport"
    assert intent.route_preference == "fastest"


@pytest.mark.asyncio
async def test_parse_current_location_and_destination():
    intent = await LocalRouteAIProvider().parse_route_request("Take me to Wakad")
    assert intent.use_current_location is True
    assert intent.destination == "Wakad"


@pytest.mark.asyncio
async def test_parse_avoid_tolls_and_highways():
    intent = await LocalRouteAIProvider().parse_route_request(
        "Go from Kothrud to Baner, avoid tolls and highways"
    )
    assert intent.avoid == ["tollRoad", "controlledAccessHighway"]


@pytest.mark.asyncio
async def test_parse_multi_stop_request_without_inventing_origin_or_final_stop():
    intent = await LocalRouteAIProvider().parse_route_request(
        "I want to visit Baner, Aundh and Wakad. Find the best order."
    )
    assert intent.destination is None
    assert intent.waypoints == ["Baner", "Aundh", "Wakad"]
    assert intent.route_preference == "optimized"


@pytest.mark.asyncio
async def test_follow_up_applies_avoidance_to_existing_route_context():
    intent = await LocalRouteAIProvider().parse_route_request(
        "avoid tolls",
        {"route_intent": {"destination": "Pune Airport", "waypoints": [], "avoid": []}},
    )
    assert intent.destination == "Pune Airport"
    assert intent.avoid == ["tollRoad"]


@pytest.mark.asyncio
async def test_unrecognized_place_text_is_not_invented_as_a_destination():
    intent = await LocalRouteAIProvider().parse_route_request("Take me to ABC")
    assert intent.destination == "ABC"


@pytest.mark.asyncio
async def test_parse_casual_destination_request_from_copilot_screen():
    intent = await LocalRouteAIProvider().parse_route_request(
        "I am go a Nagpur railway station sitabardi"
    )
    assert intent.destination == "Nagpur railway station sitabardi"
    assert intent.use_current_location is True


def test_route_endpoint_requires_real_current_location_instead_of_defaulting_to_pune():
    app.dependency_overrides[require_limited_route_planning] = lambda: {"user_id": "usr_test", "role": "user"}
    try:
        response = client.post("/api/v1/ai/route", json={"message": "Take me to Pune Airport"})
    finally:
        app.dependency_overrides.pop(require_limited_route_planning, None)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "needs_clarification"
    assert "current location" in data["message"].lower()


def test_ai_route_endpoint_requires_authentication():
    response = client.post("/api/v1/ai/route", json={"message": "Take me to Pune Airport"})
    assert response.status_code == 401


def test_free_route_planning_entitlement_can_use_grounded_chat(monkeypatch):
    app.dependency_overrides[require_limited_route_planning] = lambda: {"user_id": "usr_free", "role": "user"}
    async def no_premium_ai(user_id, feature):
        return False
    monkeypatch.setattr(ai_endpoint, "has_feature", no_premium_ai)
    try:
        response = client.post("/api/v1/ai/chat", json={"message": "hello"})
    finally:
        app.dependency_overrides.pop(require_limited_route_planning, None)
    assert response.status_code == 200
    assert response.json()["reply"]
