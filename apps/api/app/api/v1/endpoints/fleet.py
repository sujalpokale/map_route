from fastapi import APIRouter
from typing import List, Dict, Any

router = APIRouter()

# In-memory / DB synced fleet inventory baseline
MOCK_VEHICLES = [
    {
        "id": "v-101",
        "name": "Mahindra Bolero Maxi-Truck",
        "license_plate": "MH 12 QX 4512",
        "vehicle_type": "VAN",
        "fuel_type": "DIESEL",
        "fuel_efficiency": 13.2,
        "max_payload_kg": 1200.0,
        "current_payload_kg": 680.0,
        "status": "EN_ROUTE",
        "current_speed_kmh": 48.0,
        "location": {"lat": 18.5284, "lng": 73.8744, "name": "Near Pune Station"},
        "driver_name": "Rajesh Kumar",
        "assigned_trip_id": "tr-892"
    },
    {
        "id": "v-102",
        "name": "Tata Ace EV (Pure Electric)",
        "license_plate": "MH 14 EV 9901",
        "vehicle_type": "EV",
        "fuel_type": "ELECTRIC",
        "fuel_efficiency": 6.8,  # km/kWh
        "battery_capacity_kwh": 21.3,
        "current_battery_pct": 78.0,
        "max_payload_kg": 600.0,
        "current_payload_kg": 240.0,
        "status": "AVAILABLE",
        "current_speed_kmh": 0.0,
        "location": {"lat": 18.5089, "lng": 73.9260, "name": "Hadapsar Depot"},
        "driver_name": "Amit Sharma",
        "assigned_trip_id": None
    },
    {
        "id": "v-103",
        "name": "BharatBenz 1217C Logistics",
        "license_plate": "MH 12 BB 3321",
        "vehicle_type": "TRUCK",
        "fuel_type": "DIESEL",
        "fuel_efficiency": 4.6,
        "max_payload_kg": 8500.0,
        "current_payload_kg": 5400.0,
        "status": "EN_ROUTE",
        "current_speed_kmh": 58.0,
        "location": {"lat": 18.5913, "lng": 73.7389, "name": "Mumbai-Pune Expressway Link"},
        "driver_name": "Suresh Patil",
        "assigned_trip_id": "tr-910"
    },
    {
        "id": "v-104",
        "name": "TVS King Cargo CNG",
        "license_plate": "MH 12 CC 7788",
        "vehicle_type": "BIKE",
        "fuel_type": "CNG",
        "fuel_efficiency": 34.0,
        "max_payload_kg": 250.0,
        "current_payload_kg": 110.0,
        "status": "AVAILABLE",
        "current_speed_kmh": 0.0,
        "location": {"lat": 18.5314, "lng": 73.8446, "name": "Shivajinagar Hub"},
        "driver_name": "Vikas Jadhav",
        "assigned_trip_id": None
    }
]

MOCK_DRIVERS = [
    {"id": "d-01", "name": "Rajesh Kumar", "phone": "+91 98234 11223", "safety_score": 96.5, "status": "ON_TRIP", "deliveries_completed": 342, "rating": 4.9},
    {"id": "d-02", "name": "Amit Sharma", "phone": "+91 97654 33211", "safety_score": 92.0, "status": "AVAILABLE", "deliveries_completed": 218, "rating": 4.7},
    {"id": "d-03", "name": "Suresh Patil", "phone": "+91 99881 22334", "safety_score": 98.2, "status": "ON_TRIP", "deliveries_completed": 512, "rating": 4.95},
    {"id": "d-04", "name": "Vikas Jadhav", "phone": "+91 94220 55667", "safety_score": 89.4, "status": "AVAILABLE", "deliveries_completed": 140, "rating": 4.6}
]


@router.get("/vehicles")
async def get_fleet_vehicles():
    """Returns all fleet vehicles with live telematics, payload, and fuel/battery state."""
    return MOCK_VEHICLES


@router.get("/drivers")
async def get_fleet_drivers():
    """Returns active fleet drivers, duty status, safety score, and historical ratings."""
    return MOCK_DRIVERS
