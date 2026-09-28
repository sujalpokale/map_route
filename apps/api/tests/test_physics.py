from apps.api.app.engine.physics import PhysicsEngine
from apps.api.app.schemas import VehicleTypeEnum, FuelTypeEnum


def test_vehicle_physics_consumption():
    # Car test
    fuel_l, eff, cost = PhysicsEngine.calculate_consumption(
        distance_km=50.0,
        duration_min=60.0,
        vehicle_type=VehicleTypeEnum.CAR,
        fuel_type=FuelTypeEnum.PETROL,
        payload_kg=100.0
    )
    assert fuel_l > 0
    assert eff > 5.0
    assert cost > 0

    # Truck test (Truck should consume significantly more fuel than car)
    truck_fuel, truck_eff, truck_cost = PhysicsEngine.calculate_consumption(
        distance_km=50.0,
        duration_min=60.0,
        vehicle_type=VehicleTypeEnum.TRUCK,
        fuel_type=FuelTypeEnum.DIESEL,
        payload_kg=4000.0
    )
    assert truck_fuel > fuel_l
    assert truck_eff < eff


def test_cost_breakdown():
    costs = PhysicsEngine.calculate_total_route_cost(
        fuel_cost_inr=500.0,
        toll_cost_inr=120.0,
        duration_min=120.0,  # 2 hours
        distance_km=100.0,
        driver_wage_per_hour=200.0,
        maintenance_per_km=3.0
    )

    # 500 + 120 + (2 * 200 = 400) + (100 * 3 = 300) = 1320
    assert costs["driver_cost_inr"] == 400.0
    assert costs["maintenance_cost_inr"] == 300.0
    assert costs["total_cost_inr"] == 1320.0
