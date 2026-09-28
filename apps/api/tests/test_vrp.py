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
