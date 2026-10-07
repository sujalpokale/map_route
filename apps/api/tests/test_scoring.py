import pytest
from apps.api.app.schemas import (
    RouteCalculateRequest, GeoPoint, OptimizationMode, VehicleTypeEnum, FuelTypeEnum
)
from apps.api.app.providers.routing import RawRouteCandidate
from apps.api.app.providers.weather import WeatherData
from apps.api.app.engine.scoring import ScoringEngine


def test_scoring_fastest_vs_cheapest():
    # Route 1: Faster but longer with tolls
    r1 = RawRouteCandidate(
        label="Route 1 (Expressway)",
        coordinates=[[18.52, 73.85], [18.59, 73.73]],
        distance_km=38.0,
        duration_min=35.0,
        traffic_level="Low",
        traffic_delay_min=0.5,
        has_tolls=True,
        toll_cost_inr=85.0
    )

    # Route 2: Shorter & cheaper but slower with high traffic
    r2 = RawRouteCandidate(
        label="Route 2 (Old Highway)",
        coordinates=[[18.52, 73.85], [18.59, 73.73]],
        distance_km=32.0,
        duration_min=55.0,
        traffic_level="High",
        traffic_delay_min=14.0,
        has_tolls=False,
        toll_cost_inr=0.0
    )

    weather = WeatherData("Clear", 28.0, 0.0, 10.0, 10.0, 95.0)

    # Test under FASTEST mode -> Route 1 should score higher
    req_fastest = RouteCalculateRequest(
        origin=GeoPoint(lat=18.52, lng=73.85),
        destination=GeoPoint(lat=18.59, lng=73.73),
        optimization_mode=OptimizationMode.FASTEST
    )
    res_fastest = ScoringEngine.evaluate_candidates([r1, r2], req_fastest, weather)
    assert res_fastest[0].label == "Route 1 (Expressway)"
    assert res_fastest[0].is_recommended is True

    # Test under CHEAPEST mode -> Route 2 should score higher because no tolls and less distance
    req_cheapest = RouteCalculateRequest(
        origin=GeoPoint(lat=18.52, lng=73.85),
        destination=GeoPoint(lat=18.59, lng=73.73),
        optimization_mode=OptimizationMode.CHEAPEST
    )
    res_cheapest = ScoringEngine.evaluate_candidates([r1, r2], req_cheapest, weather)
    assert res_cheapest[0].label == "Route 2 (Old Highway)"
    assert res_cheapest[0].is_recommended is True


def test_vehicle_specific_route_selection():
    from apps.api.app.providers.routing import SimulatedFallbackRoutingProvider

    provider = SimulatedFallbackRoutingProvider()
    p1 = GeoPoint(lat=12.9716, lng=77.5946)
    p2 = GeoPoint(lat=12.9352, lng=77.6245)
    weather = WeatherData("Clear", 26.0, 0.0, 8.0, 10.0, 95.0)

    # TRUCK selection -> Should recommend Freight Bypass
    req_truck = RouteCalculateRequest(origin=p1, destination=p2, vehicle_type=VehicleTypeEnum.TRUCK)
    raw_truck = provider.get_routes_sync(p1, p2, vehicle_type=VehicleTypeEnum.TRUCK)
    res_truck = ScoringEngine.evaluate_candidates(raw_truck, req_truck, weather)
    assert "Freight Bypass" in res_truck[0].label
    assert res_truck[0].is_recommended is True

    # BIKE selection -> Should recommend Direct Urban Shortcut, 0 tolls
    req_bike = RouteCalculateRequest(origin=p1, destination=p2, vehicle_type=VehicleTypeEnum.BIKE)
    raw_bike = provider.get_routes_sync(p1, p2, vehicle_type=VehicleTypeEnum.BIKE)
    res_bike = ScoringEngine.evaluate_candidates(raw_bike, req_bike, weather)
    assert "Shortcut" in res_bike[0].label or "Direct Urban Short-Cut" in res_bike[0].label
    assert res_bike[0].toll_cost_inr == 0.0
    assert res_bike[0].is_recommended is True


    # EV selection -> Should recommend Green Eco-Arterial
    req_ev = RouteCalculateRequest(origin=p1, destination=p2, vehicle_type=VehicleTypeEnum.EV)
    raw_ev = provider.get_routes_sync(p1, p2, vehicle_type=VehicleTypeEnum.EV)
    res_ev = ScoringEngine.evaluate_candidates(raw_ev, req_ev, weather)
    assert "Green Eco-Arterial" in res_ev[0].label
    assert res_ev[0].is_recommended is True


