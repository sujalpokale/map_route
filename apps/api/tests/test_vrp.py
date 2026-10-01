from apps.api.app.schemas import OptimizeStopsRequest, StopItem, GeoPoint, VehicleTypeEnum
from apps.api.app.engine.vrp_optimizer import VRPOptimizer


def test_vrp_optimizer():
    req = OptimizeStopsRequest(
        origin=GeoPoint(lat=18.5204, lng=73.8567, address="Pune Hub"),
        destination=GeoPoint(lat=18.5204, lng=73.8567, address="Pune Hub"),
        stops=[
            StopItem(id="s1", address="Stop A", lat=18.5314, lng=73.8446, priority=1),
            StopItem(id="s2", address="Stop B", lat=18.5913, lng=73.7389, priority=3),  # Urgent
            StopItem(id="s3", address="Stop C", lat=18.5089, lng=73.9260, priority=1),
        ],
        vehicle_type=VehicleTypeEnum.VAN
    )

    res = VRPOptimizer.optimize_delivery_sequence(req)
    assert len(res.ordered_stops) == 3
    assert res.total_distance_km > 0
    assert len(res.polyline_coordinates) > 0
    assert res.vehicle_type == "VAN"
    assert res.road_type_summary is not None


def test_vrp_optimizer_bike_vs_truck():
    base_origin = GeoPoint(lat=18.5204, lng=73.8567, address="Pune Central")
    stops = [
        StopItem(id="s1", address="Narrow Alley 1, Kasba Peth", lat=18.5210, lng=73.8570, priority=1),
        StopItem(id="s2", address="Local Lane 2, Raviwar Peth", lat=18.5180, lng=73.8590, priority=2),
    ]

    bike_req = OptimizeStopsRequest(
        origin=base_origin,
        stops=stops,
        vehicle_type=VehicleTypeEnum.BIKE
    )
    bike_res = VRPOptimizer.optimize_delivery_sequence(bike_req)
    assert bike_res.vehicle_type == "BIKE"
    assert "Small" in bike_res.road_type_summary or "Alley" in bike_res.road_type_summary
    assert bike_res.average_speed_kmh == 18.0

    truck_req = OptimizeStopsRequest(
        origin=base_origin,
        stops=stops,
        vehicle_type=VehicleTypeEnum.TRUCK
    )
    truck_res = VRPOptimizer.optimize_delivery_sequence(truck_req)
    assert truck_res.vehicle_type == "TRUCK"
    assert "Freight" in truck_res.road_type_summary or "Bypass" in truck_res.road_type_summary
    assert truck_res.average_speed_kmh == 26.0
