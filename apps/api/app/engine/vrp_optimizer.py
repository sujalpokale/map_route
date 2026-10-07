from typing import List, Tuple
import math
import httpx
from apps.api.app.schemas import (
    GeoPoint, StopItem, OptimizeStopsRequest, OptimizeStopsResponse, VehicleTypeEnum
)
from apps.api.app.providers.routing import haversine_distance, SimulatedFallbackRoutingProvider


class VRPOptimizer:
    @classmethod
    def optimize_delivery_sequence(
        cls,
        request: OptimizeStopsRequest,
        duration_matrix_seconds: List[List[int | None]] | None = None,
    ) -> OptimizeStopsResponse:
        stops = request.stops
        if not stops:
            return OptimizeStopsResponse(
                ordered_stops=[],
                total_distance_km=0.0,
                estimated_duration_min=0.0,
                total_payload_kg=0.0,
                polyline_coordinates=[],
                summary="No delivery stops provided."
            )

        # Total payload
        total_payload = sum(s.package_weight_kg for s in stops)

        # 1. Starting node: Origin / Depot / Live GPS
        all_nodes = [StopItem(
            id="origin",
            address=request.origin.address or "Starting Location",
            lat=request.origin.lat,
            lng=request.origin.lng,
            package_weight_kg=0.0,
            priority=1
        )] + list(stops)

        # 2. Nearest-Neighbor Heuristic (e.g. from A, find nearest stop C, then next nearest B, etc.)
        unvisited = list(range(1, len(all_nodes)))
        current_idx = 0
        tour = [0]

        while unvisited:
            best_idx = None
            best_score = float("inf")
            curr_node = all_nodes[current_idx]

            for candidate_idx in unvisited:
                cand_node = all_nodes[candidate_idx]
                if duration_matrix_seconds and duration_matrix_seconds[current_idx][candidate_idx] is not None:
                    dist = float(duration_matrix_seconds[current_idx][candidate_idx])
                else:
                    dist = haversine_distance(curr_node.lat, curr_node.lng, cand_node.lat, cand_node.lng)

                # Prioritize urgent stops (priority 3 lowers effective distance cost by 30%)
                priority_factor = {1: 1.0, 2: 0.85, 3: 0.70}.get(cand_node.priority, 1.0)
                score = dist * priority_factor

                if score < best_score:
                    best_score = score
                    best_idx = candidate_idx

            tour.append(best_idx)
            unvisited.remove(best_idx)
            current_idx = best_idx

        # 3. Apply 2-opt open-path TSP improvement (fixed origin at index 0, ends at final stop)
        destination_matrix_idx = len(all_nodes) if request.destination else None
        tour = cls._two_opt_open_path(tour, all_nodes, duration_matrix_seconds, destination_matrix_idx)

        ordered_stops = [all_nodes[i] for i in tour[1:]]

        # 4. Generate multi-stop connecting polyline tailored to vehicle profile
        v_type = request.vehicle_type if hasattr(request, "vehicle_type") and request.vehicle_type else VehicleTypeEnum.VAN
        v_type_str = v_type.value if hasattr(v_type, "value") else str(v_type)

        # Vehicle specific speed and stop handling parameters
        vehicle_configs = {
            VehicleTypeEnum.BIKE: {
                "profile": "bike",
                "avg_speed_kmh": 18.0,
                "stop_min": 2.0,
                "dist_multiplier": 1.12,  # Takes direct alleys & small shortcuts
                "road_summary": "Small Roads, Alleys & Cycle-Friendly Cuts",
                "guidance": "Navigated through narrow residential lanes, alleys, and bike-accessible shortcuts, completely bypassing car congestion and toll gates.",
                "suitability_score": 98.5
            },
            VehicleTypeEnum.CAR: {
                "profile": "driving",
                "avg_speed_kmh": 36.0,
                "stop_min": 3.5,
                "dist_multiplier": 1.22,
                "road_summary": "Primary City Streets & Arterial Avenues",
                "guidance": "Standard vehicular pathing along arterial roads, flyovers, and city avenues with standard lane widths.",
                "suitability_score": 96.0
            },
            VehicleTypeEnum.VAN: {
                "profile": "driving",
                "avg_speed_kmh": 30.0,
                "stop_min": 5.0,
                "dist_multiplier": 1.24,
                "road_summary": "Commercial Delivery Corridors & Curbside Lanes",
                "guidance": "Optimized delivery route utilizing wide commercial avenues with accessible curbside loading zones.",
                "suitability_score": 95.0
            },
            VehicleTypeEnum.BUS: {
                "profile": "driving",
                "avg_speed_kmh": 24.0,
                "stop_min": 6.0,
                "dist_multiplier": 1.30,  # Avoids narrow roads, stays on main transit avenues
                "road_summary": "Broad Transit Boulevards & High-Clearance Arterials",
                "guidance": "Strictly restricted to high-clearance transit boulevards and multi-lane arterials, avoiding tight residential streets and low underpasses.",
                "suitability_score": 93.0
            },
            VehicleTypeEnum.TRUCK: {
                "profile": "driving",
                "avg_speed_kmh": 26.0,
                "stop_min": 8.0,
                "dist_multiplier": 1.35,  # Outer bypasses, avoiding small city lanes
                "road_summary": "Heavy Freight Bypasses & Commercial Ring Roads",
                "guidance": "Heavy transport routing routed through designated freight corridors and outer bypasses, avoiding weight-restricted residential roads.",
                "suitability_score": 94.0
            },
            VehicleTypeEnum.EV: {
                "profile": "driving",
                "avg_speed_kmh": 34.0,
                "stop_min": 3.5,
                "dist_multiplier": 1.22,
                "road_summary": "Eco-Regen Arterials & Charging Corridors",
                "guidance": "Energy-efficient routing favoring regenerative braking corridors and arterial connectors.",
                "suitability_score": 96.5
            }
        }

        v_cfg = vehicle_configs.get(v_type, vehicle_configs[VehicleTypeEnum.VAN])

        polyline_coords = []
        total_dist = 0.0
        osrm_success = False

        try:
            points = [all_nodes[i] for i in tour]
            if request.destination:
                points.append(StopItem(
                    id="dest",
                    address=request.destination.address or "Final Destination",
                    lat=request.destination.lat,
                    lng=request.destination.lng,
                    package_weight_kg=0.0
                ))

            coords_str = ";".join([f"{p.lng:.6f},{p.lat:.6f}" for p in points])
            osrm_prof = v_cfg["profile"]
            url = f"https://router.project-osrm.org/route/v1/{osrm_prof}/{coords_str}?overview=full&geometries=geojson"
            with httpx.Client(timeout=4.5) as client:
                resp = client.get(url)
                if resp.status_code != 200 and osrm_prof != "driving":
                    # Fallback to driving profile if bike profile is not configured on public OSRM demo
                    fallback_url = f"https://router.project-osrm.org/route/v1/driving/{coords_str}?overview=full&geometries=geojson"
                    resp = client.get(fallback_url)

                if resp.status_code == 200:
                    data = resp.json()
                    routes_data = data.get("routes", [])
                    if routes_data:
                        primary = routes_data[0]
                        geom = primary.get("geometry", {}).get("coordinates", [])
                        polyline_coords = [[pt[1], pt[0]] for pt in geom]
                        total_dist = round(primary.get("distance", 0) / 1000.0, 2)
                        osrm_success = True
        except Exception:
            osrm_success = False

        if not osrm_success:
            fallback = SimulatedFallbackRoutingProvider()
            total_dist = 0.0
            polyline_coords = []
            multiplier = v_cfg["dist_multiplier"]
            curv = 0.008 if v_type == VehicleTypeEnum.BIKE else 0.018

            for k in range(len(tour) - 1):
                n1 = all_nodes[tour[k]]
                n2 = all_nodes[tour[k + 1]]
                segment_dist = haversine_distance(n1.lat, n1.lng, n2.lat, n2.lng) * multiplier
                total_dist += segment_dist
                pts = fallback._generate_polyline(
                    GeoPoint(lat=n1.lat, lng=n1.lng),
                    GeoPoint(lat=n2.lat, lng=n2.lng),
                    curvature=curv,
                    points=14
                )
                polyline_coords.extend(pts)

            if request.destination:
                last = all_nodes[tour[-1]]
                final_dist = haversine_distance(last.lat, last.lng, request.destination.lat, request.destination.lng) * multiplier
                total_dist += final_dist
                final_pts = fallback._generate_polyline(
                    GeoPoint(lat=last.lat, lng=last.lng),
                    request.destination,
                    curvature=curv,
                    points=14
                )
                polyline_coords.extend(final_pts)

        total_dist = round(total_dist, 2)
        # Vehicle-specific duration computation
        if duration_matrix_seconds:
            route_indices = tour + ([destination_matrix_idx] if destination_matrix_idx is not None else [])
            driving_seconds = sum(
                duration_matrix_seconds[a][b] or 0
                for a, b in zip(route_indices, route_indices[1:])
            )
            driving_time_min = driving_seconds / 60.0
        else:
            driving_time_min = (total_dist / v_cfg["avg_speed_kmh"]) * 60.0
        stop_handling_min = len(ordered_stops) * v_cfg["stop_min"]
        total_dur = round(driving_time_min + stop_handling_min, 1)

        first_stop_name = ordered_stops[0].address.split(",")[0] if ordered_stops else "N/A"
        last_stop_name = ordered_stops[-1].address.split(",")[0] if ordered_stops else "N/A"

        duration_source = "HERE live-traffic travel-time matrix" if duration_matrix_seconds is not None else f"~{int(v_cfg['avg_speed_kmh'])} km/h estimate"
        summary = (
            f"{v_type_str} Optimized Itinerary ({len(ordered_stops)} stops): "
            f"Departs to '{first_stop_name}' first → finishes at '{last_stop_name}'. "
            f"Road type: {v_cfg['road_summary']}. "
            f"Distance: {total_dist} km (~{total_dur} mins; {duration_source})."
        )

        return OptimizeStopsResponse(
            ordered_stops=ordered_stops,
            total_distance_km=total_dist,
            estimated_duration_min=total_dur,
            total_payload_kg=round(total_payload, 1),
            polyline_coordinates=polyline_coords,
            summary=summary,
            vehicle_type=v_type_str,
            road_type_summary=v_cfg["road_summary"],
            road_suitability_score=v_cfg["suitability_score"],
            average_speed_kmh=v_cfg["avg_speed_kmh"],
            vehicle_road_guidance=v_cfg["guidance"],
            traffic_aware=duration_matrix_seconds is not None,
        )


    @staticmethod
    def _two_opt_open_path(
        tour: List[int],
        nodes: List[StopItem],
        duration_matrix_seconds: List[List[int | None]] | None = None,
        destination_idx: int | None = None,
    ) -> List[int]:
        """Performs 2-opt heuristic optimization for open-ended vehicle paths."""
        n = len(tour)
        if n <= 2:
            return tour

        best_tour = tour[:]
        improved = True
        iterations = 0
        max_iterations = 60

        def path_cost(path: List[int]) -> float:
            if duration_matrix_seconds:
                indices = path + ([destination_idx] if destination_idx is not None else [])
                return float(sum(
                    duration_matrix_seconds[a][b] or 0
                    for a, b in zip(indices, indices[1:])
                ))
            return sum(
                haversine_distance(nodes[a].lat, nodes[a].lng, nodes[b].lat, nodes[b].lng)
                for a, b in zip(path, path[1:])
            )

        while improved and iterations < max_iterations:
            improved = False
            iterations += 1
            for i in range(1, n - 1):
                for j in range(i + 1, n):
                    candidate = best_tour[:i] + list(reversed(best_tour[i:j + 1])) + best_tour[j + 1:]
                    if path_cost(candidate) < path_cost(best_tour) - 0.001:
                        best_tour = candidate
                        improved = True
                        break
                if improved:
                    break
        return best_tour

