import datetime
from typing import List, Dict, Any, Optional
import uuid

from apps.api.app.schemas import (
    CandidateRoute, SubScores, OptimizationMode, VehicleTypeEnum,
    FuelTypeEnum, RouteCalculateRequest
)
from apps.api.app.providers.routing import RawRouteCandidate
from apps.api.app.providers.weather import WeatherData
from apps.api.app.engine.physics import PhysicsEngine

# Configurable weight vectors for each optimization strategy
MODE_WEIGHTS: Dict[OptimizationMode, Dict[str, float]] = {
    OptimizationMode.FASTEST: {
        "time": 0.38, "traffic": 0.22, "vehicle": 0.12, "distance": 0.08,
        "safety": 0.06, "road": 0.05, "fuel": 0.05, "cost": 0.04, "weather": 0.00
    },
    OptimizationMode.SHORTEST: {
        "distance": 0.44, "vehicle": 0.12, "time": 0.18, "fuel": 0.08,
        "cost": 0.06, "traffic": 0.05, "road": 0.04, "safety": 0.03, "weather": 0.00
    },
    OptimizationMode.CHEAPEST: {
        "cost": 0.42, "fuel": 0.22, "vehicle": 0.12, "distance": 0.08,
        "time": 0.06, "traffic": 0.04, "road": 0.03, "safety": 0.03, "weather": 0.00
    },
    OptimizationMode.FUEL_EFFICIENT: {
        "fuel": 0.38, "vehicle": 0.15, "cost": 0.15, "time": 0.12,
        "traffic": 0.10, "distance": 0.05, "road": 0.03, "weather": 0.02, "safety": 0.00
    },
    OptimizationMode.BALANCED: {
        "time": 0.22, "fuel": 0.18, "vehicle": 0.15, "cost": 0.15,
        "traffic": 0.14, "distance": 0.08, "safety": 0.04, "road": 0.02, "weather": 0.02
    },
    OptimizationMode.FLEET_OPTIMIZED: {
        "cost": 0.24, "vehicle": 0.20, "time": 0.18, "fuel": 0.18,
        "traffic": 0.08, "distance": 0.05, "road": 0.04, "weather": 0.02, "safety": 0.01
    },
    OptimizationMode.EV_OPTIMAL: {
        "fuel": 0.34, "vehicle": 0.22, "time": 0.16, "cost": 0.12,
        "traffic": 0.08, "distance": 0.04, "road": 0.02, "weather": 0.02, "safety": 0.00
    },
    OptimizationMode.CUSTOM: {
        "time": 0.22, "fuel": 0.18, "vehicle": 0.15, "cost": 0.15,
        "traffic": 0.14, "distance": 0.08, "safety": 0.04, "road": 0.02, "weather": 0.02
    }
}


class ScoringEngine:
    @classmethod
    def evaluate_candidates(
        cls,
        raw_candidates: List[RawRouteCandidate],
        request: RouteCalculateRequest,
        weather: WeatherData
    ) -> List[CandidateRoute]:
        if not raw_candidates:
            return []

        # 1. Compute physical metrics for each candidate
        computed_metrics = []
        for raw in raw_candidates:
            consumed, eff, f_cost = PhysicsEngine.calculate_consumption(
                distance_km=raw.distance_km,
                duration_min=raw.duration_min,
                vehicle_type=request.vehicle_type,
                fuel_type=request.fuel_type,
                payload_kg=request.payload_kg or 0.0,
                custom_efficiency=request.fuel_efficiency_kmpl,
                traffic_delay_min=raw.traffic_delay_min,
                custom_fuel_price=request.fuel_price_inr,
            )

            cost_breakdown = PhysicsEngine.calculate_total_route_cost(
                fuel_cost_inr=f_cost,
                toll_cost_inr=raw.toll_cost_inr,
                duration_min=raw.duration_min,
                distance_km=raw.distance_km
            )

            computed_metrics.append({
                "raw": raw,
                "fuel_litres": consumed,
                "effective_kmpl": eff,
                "fuel_cost_inr": f_cost,
                "toll_cost_inr": raw.toll_cost_inr,
                "driver_cost_inr": cost_breakdown["driver_cost_inr"],
                "maintenance_cost_inr": cost_breakdown["maintenance_cost_inr"],
                "total_cost_inr": cost_breakdown["total_cost_inr"]
            })

        # 2. Find minimum baselines across candidate pool for normalization
        min_time = min(m["raw"].duration_min for m in computed_metrics)
        min_dist = min(m["raw"].distance_km for m in computed_metrics)
        min_fuel = min(m["fuel_litres"] for m in computed_metrics)
        min_cost = min(m["total_cost_inr"] for m in computed_metrics)

        # 3. Weights
        mode = request.optimization_mode
        weights = MODE_WEIGHTS.get(mode, MODE_WEIGHTS[OptimizationMode.BALANCED])
        if mode == OptimizationMode.CUSTOM and request.custom_weights:
            weights = {**weights, **request.custom_weights}

        routes: List[CandidateRoute] = []
        now = datetime.datetime.now(datetime.timezone.utc)

        for m in computed_metrics:
            raw = m["raw"]

            # Sub-scores 0 - 100
            time_score = round(min(100.0, (min_time / max(raw.duration_min, 1.0)) * 100.0), 1)
            distance_score = round(min(100.0, (min_dist / max(raw.distance_km, 0.1)) * 100.0), 1)
            fuel_score = round(min(100.0, (min_fuel / max(m["fuel_litres"], 0.1)) * 100.0), 1)
            cost_score = round(min(100.0, (min_cost / max(m["total_cost_inr"], 1.0)) * 100.0), 1)

            # Traffic score
            traffic_map = {
                "low": 96.0,
                "moderate": 78.0,
                "high": 52.0,
                "severe": 30.0,
            }
            traffic_known = raw.traffic_level.lower() in traffic_map
            base_traffic_score = traffic_map.get(raw.traffic_level.lower(), 50.0)
            traffic_penalty = min(raw.traffic_delay_min * 2.0, 30.0) if traffic_known else 0.0
            traffic_score = round(max(10.0, base_traffic_score - traffic_penalty), 1)

            # Weather score from provider
            weather_score = round(weather.weather_score, 1)

            # Road score
            road_map = {"Good": 95.0, "Moderate": 75.0, "Poor": 40.0}
            road_score = round(road_map.get(raw.road_quality, 80.0), 1)

            # Safety score
            safety_score = round((traffic_score * 0.4) + (weather_score * 0.3) + (road_score * 0.3), 1)

            # Vehicle compatibility score (dynamic & vehicle-aware)
            v_type_str = request.vehicle_type.value if hasattr(request.vehicle_type, "value") else str(request.vehicle_type)
            if hasattr(raw, "vehicle_suitability") and raw.vehicle_suitability and v_type_str in raw.vehicle_suitability:
                vehicle_compat_score = raw.vehicle_suitability[v_type_str]
            else:
                vehicle_compat_score = 92.0
                road_type = getattr(raw, "road_type", "arterial")
                if request.vehicle_type in [VehicleTypeEnum.TRUCK, VehicleTypeEnum.BUS]:
                    if road_type in ["highway", "bypass"]:
                        vehicle_compat_score = 98.0
                    elif road_type == "arterial":
                        vehicle_compat_score = 82.0
                    else:  # urban narrow
                        vehicle_compat_score = 32.0
                    if raw.road_quality != "Good":
                        vehicle_compat_score -= 25.0
                elif request.vehicle_type == VehicleTypeEnum.BIKE:
                    if road_type in ["urban", "arterial"] and not raw.has_tolls:
                        vehicle_compat_score = 99.0
                    elif road_type == "highway" or raw.has_tolls:
                        vehicle_compat_score = 25.0
                elif request.vehicle_type == VehicleTypeEnum.EV:
                    if "Eco" in raw.label or road_type == "arterial":
                        vehicle_compat_score = 98.0
                    elif road_type == "highway":
                        vehicle_compat_score = 86.0
                elif request.vehicle_type == VehicleTypeEnum.CAR:
                    if road_type == "highway":
                        vehicle_compat_score = 97.0
                    else:
                        vehicle_compat_score = 92.0
                elif request.vehicle_type == VehicleTypeEnum.VAN:
                    vehicle_compat_score = 95.0

            vehicle_compat_score = round(min(max(vehicle_compat_score, 10.0), 99.9), 1)

            sub = SubScores(
                time_score=time_score,
                fuel_score=fuel_score,
                cost_score=cost_score,
                traffic_score=traffic_score,
                distance_score=distance_score,
                weather_score=weather_score,
                road_condition_score=road_score,
                safety_score=safety_score,
                vehicle_compatibility_score=vehicle_compat_score
            )

            # Overall Score weighted sum
            overall = (
                weights.get("time", 0.25) * sub.time_score +
                weights.get("fuel", 0.20) * sub.fuel_score +
                weights.get("cost", 0.15) * sub.cost_score +
                weights.get("traffic", 0.15) * sub.traffic_score +
                weights.get("distance", 0.10) * sub.distance_score +
                weights.get("weather", 0.05) * sub.weather_score +
                weights.get("road", 0.05) * sub.road_condition_score +
                weights.get("safety", 0.05) * sub.safety_score +
                weights.get("vehicle", 0.15) * sub.vehicle_compatibility_score
            )
            overall = round(min(max(overall, 10.0), 99.9), 1)

            eta_time = now + datetime.timedelta(minutes=raw.duration_min)

            routes.append(CandidateRoute(
                id=str(uuid.uuid4())[:8],
                label=raw.label,
                coordinates=raw.coordinates,
                distance_km=raw.distance_km,
                duration_min=raw.duration_min,
                eta_iso=eta_time.strftime("%I:%M %p"),
                fuel_litres=m["fuel_litres"],
                fuel_cost_inr=m["fuel_cost_inr"],
                toll_cost_inr=m["toll_cost_inr"],
                driver_cost_inr=m["driver_cost_inr"],
                maintenance_cost_inr=m["maintenance_cost_inr"],
                total_cost_inr=m["total_cost_inr"],
                traffic_delay_min=raw.traffic_delay_min,
                traffic_level=raw.traffic_level,
                weather_condition=weather.condition,
                road_quality=raw.road_quality,
                overall_score=overall,
                sub_scores=sub,
                recommendation_reason="",
                is_recommended=False,
                steps=raw.steps
            ))

        # Sort routes by overall score descending
        routes.sort(key=lambda r: r.overall_score, reverse=True)
        if routes:
            routes[0].is_recommended = True

        # Generate contextual natural-language explanation for all candidates
        cls._generate_explanations(routes, mode, request.vehicle_type)

        return routes

    @classmethod
    def _generate_explanations(
        cls,
        routes: List[CandidateRoute],
        mode: OptimizationMode,
        vehicle_type: VehicleTypeEnum = VehicleTypeEnum.CAR
    ):
        if not routes:
            return

        best = routes[0]
        v_name = vehicle_type.value if hasattr(vehicle_type, "value") else str(vehicle_type)

        if len(routes) == 1:
            best.recommendation_reason = f"Selected as optimal path matching {mode.value} criteria for {v_name}."
            return

        runner_up = routes[1]
        time_diff = round(runner_up.duration_min - best.duration_min, 1)
        fuel_diff = round(runner_up.fuel_litres - best.fuel_litres, 2)
        cost_diff = round(runner_up.total_cost_inr - best.total_cost_inr, 2)

        reasons = []
        if time_diff > 0:
            reasons.append(f"{time_diff} min faster")
        elif time_diff < 0:
            reasons.append(f"{-time_diff} min longer with superior vehicle efficiency")

        if fuel_diff > 0:
            reasons.append(f"saves {fuel_diff} L fuel/energy")
        if cost_diff > 0:
            reasons.append(f"reduces total trip cost by ₹{cost_diff}")
        if best.traffic_level == "Low" and runner_up.traffic_level in ["Moderate", "High", "Severe"]:
            reasons.append("bypasses high congestion zones")
        if best.toll_cost_inr == 0 and runner_up.toll_cost_inr > 0:
            reasons.append(f"avoids ₹{runner_up.toll_cost_inr} in tolls")

        # Vehicle-specific highlighted rationale
        vehicle_highlights = {
            "TRUCK": "Optimized for heavy freight clearance, bridge capacity, and smooth bypass speeds",
            "BUS": "Optimized for commercial passenger axle load and arterial clearance",
            "BIKE": "Optimized for two-wheeler shortcut mobility, zero tolls, and traffic filtering",
            "EV": "Optimized for regenerative energy recapture and minimal high-speed aero drain",
            "VAN": "Optimized for urban logistics delivery access and balanced arterial transit",
            "CAR": "Optimized for express speed and direct flyover transit"
        }
        veh_highlight = vehicle_highlights.get(v_name, f"Optimized for {v_name}")

        summary_reason = ", ".join(reasons) if reasons else "Best balance across transport objectives"
        best.recommendation_reason = (
            f"Selected as the #1 recommended route for {v_name} under '{mode.value}' strategy. "
            f"{veh_highlight}. {summary_reason}."
        )

        for i, alt in enumerate(routes[1:], start=2):
            diff_time_txt = f"{round(alt.duration_min - best.duration_min, 1):+g}m"
            diff_cost_txt = f"{round(alt.total_cost_inr - best.total_cost_inr, 2):+g}₹"
            alt.recommendation_reason = (
                f"Alternative choice #{i} for {v_name}. Trade-off vs Primary: {diff_time_txt} duration, "
                f"{diff_cost_txt} cost with {alt.traffic_level.lower()} traffic."
            )
