import pytest
from fastapi.testclient import TestClient
from apps.api.app.main import app
from apps.api.app.services.feature_access import require_limited_route_planning
from apps.api.app.api.v1.endpoints import ai as ai_endpoint

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


def test_openai_compatible_model_discovery():
    response = client.get("/v1/models")
    assert response.status_code == 200
    data = response.json()
    assert data["object"] == "list"
    assert data["data"][0]["id"]
    assert data["data"][0]["owned_by"]


def test_subscription_plan_prices():
    response = client.get("/api/v1/subscriptions/plans")
    assert response.status_code == 200
    prices = {
        (plan["plan"], plan["billing_cycle"]): plan["price"]
        for plan in response.json()["plans"]
    }
    assert prices[("free", None)] == 0
    assert prices[("premium", "monthly")] == 199
    assert prices[("premium", "yearly")] == 1499


def test_calculate_routes_api():
    payload = {
        "origin": {"lat": 18.5204, "lng": 73.8567, "address": "Pune Station"},
        "destination": {"lat": 18.5913, "lng": 73.7389, "address": "Hinjawadi IT Park"},
        "vehicle_type": "CAR",
        "fuel_type": "PETROL",
        "optimization_mode": "Balanced"
    }
    response = client.post("/api/v1/routes/calculate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["routes"]) >= 1
    assert data["best_route_id"] != ""
    assert data["routes"][0]["overall_score"] > 0
    assert len(data["routes"][0]["coordinates"]) > 0


def test_predict_eta_api():
    payload = {
        "distance_km": 35.0,
        "base_duration_min": 40.0,
        "traffic_level": "Moderate",
        "weather_condition": "Clear",
        "road_type": "highway",
        "hour_of_day": 17,
        "day_of_week": 3,
        "vehicle_type": "CAR"
    }
    response = client.post("/api/v1/predict/eta", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["predicted_duration_min"] >= 35.0
    assert len(data["confidence_interval_min"]) == 2


def test_ai_chat_api(monkeypatch):
    payload = {
        "message": "Which route will use less fuel from Pune to Hinjawadi?"
    }
    app.dependency_overrides[require_limited_route_planning] = lambda: {"user_id": "usr_test", "role": "user"}
    async def no_premium_ai(user_id, feature):
        return False
    monkeypatch.setattr(ai_endpoint, "has_feature", no_premium_ai)
    try:
        response = client.post("/api/v1/ai/chat", json=payload)
    finally:
        app.dependency_overrides.pop(require_limited_route_planning, None)
    assert response.status_code == 200
    data = response.json()
    assert "reply" in data
    assert len(data["reply"]) > 20


def test_ocr_location_api():
    payload = {
        "raw_text": "Delivery To: Tech Park, Phase 1, Hinjawadi, Pune 411057"
    }
    response = client.post("/api/v1/ocr/parse-location", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["locations"]) == 1
    assert data["locations"][0]["pincode"] == "411057"
