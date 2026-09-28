from typing import List, Tuple
import math
import httpx
from apps.api.app.schemas import (
    GeoPoint, StopItem, OptimizeStopsRequest, OptimizeStopsResponse
)
from apps.api.app.providers.routing import haversine_distance, SimulatedFallbackRoutingProvider


class VRPOptimizer:
    @classmethod
    def optimize_delivery_sequence(cls, request: OptimizeStopsRequest) -> OptimizeStopsResponse:
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
        tour = cls._two_opt_open_path(tour, all_nodes)

        ordered_stops = [all_nodes[i] for i in tour[1:]]

        # 4. Generate multi-stop connecting polyline
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
            url = f"https://router.project-osrm.org/route/v1/driving/{coords_str}?overview=full&geometries=geojson"
            with httpx.Client(timeout=4.0) as client:
                resp = client.get(url)
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
            for k in range(len(tour) - 1):
                n1 = all_nodes[tour[k]]
                n2 = all_nodes[tour[k + 1]]
                segment_dist = haversine_distance(n1.lat, n1.lng, n2.lat, n2.lng) * 1.25
                total_dist += segment_dist
                pts = fallback._generate_polyline(
                    GeoPoint(lat=n1.lat, lng=n1.lng),
                    GeoPoint(lat=n2.lat, lng=n2.lng),
                    curvature=0.015,
                    points=12
                )
                polyline_coords.extend(pts)

            if request.destination:
                last = all_nodes[tour[-1]]
                final_dist = haversine_distance(last.lat, last.lng, request.destination.lat, request.destination.lng) * 1.25
                total_dist += final_dist
                final_pts = fallback._generate_polyline(
                    GeoPoint(lat=last.lat, lng=last.lng),
                    request.destination,
                    curvature=0.015,
                    points=12
                )
                polyline_coords.extend(final_pts)

        total_dist = round(total_dist, 2)
        # Average urban speed 32 km/h + 5 mins handling per delivery stop
        driving_time_min = (total_dist / 32.0) * 60.0
        stop_handling_min = len(ordered_stops) * 4.5
        total_dur = round(driving_time_min + stop_handling_min, 1)

        first_stop_name = ordered_stops[0].address.split(",")[0] if ordered_stops else "N/A"
        last_stop_name = ordered_stops[-1].address.split(",")[0] if ordered_stops else "N/A"

        summary = (
            f"Nearest-first optimized sequence for {len(ordered_stops)} deliveries: "
            f"Departing to nearest '{first_stop_name}' first → ending at final stop '{last_stop_name}'. "
            f"Total distance: {total_dist} km ({total_dur} mins)."
        )

        return OptimizeStopsResponse(
            ordered_stops=ordered_stops,
            total_distance_km=total_dist,
            estimated_duration_min=total_dur,
            total_payload_kg=round(total_payload, 1),
            polyline_coordinates=polyline_coords,
            summary=summary
        )

    @staticmethod
    def _two_opt_open_path(tour: List[int], nodes: List[StopItem]) -> List[int]:
        """Performs 2-opt heuristic optimization for open-ended vehicle paths."""
        n = len(tour)
        if n <= 3:
            return tour

        best_tour = tour[:]
        improved = True
        iterations = 0
        max_iterations = 60

        while improved and iterations < max_iterations:
            improved = False
            iterations += 1
            for i in range(1, n - 1):
                for j in range(i + 1, n):
                    curr_cost = haversine_distance(
                        nodes[best_tour[i - 1]].lat, nodes[best_tour[i - 1]].lng,
                        nodes[best_tour[i]].lat, nodes[best_tour[i]].lng
                    )
                    new_cost = haversine_distance(
                        nodes[best_tour[i - 1]].lat, nodes[best_tour[i - 1]].lng,
                        nodes[best_tour[j]].lat, nodes[best_tour[j]].lng
                    )

                    if j + 1 < n:
                        curr_cost += haversine_distance(
                            nodes[best_tour[j]].lat, nodes[best_tour[j]].lng,
                            nodes[best_tour[j + 1]].lat, nodes[best_tour[j + 1]].lng
                        )
                        new_cost += haversine_distance(
                            nodes[best_tour[i]].lat, nodes[best_tour[i]].lng,
                            nodes[best_tour[j + 1]].lat, nodes[best_tour[j + 1]].lng
                        )

                    if new_cost < curr_cost - 0.001:
                        best_tour[i:j + 1] = list(reversed(best_tour[i:j + 1]))
                        improved = True
                        break
                if improved:
                    break
        return best_tour

