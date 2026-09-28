import pytest
from fastapi.testclient import TestClient
from apps.api.app.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


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


def test_ai_chat_api():
    payload = {
        "message": "Which route will use less fuel from Pune to Hinjawadi?"
    }
    response = client.post("/api/v1/ai/chat", json=payload)
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
