import abc
from typing import List, Dict, Any, Optional
import httpx
import math
import logging

from apps.api.app.core.config import settings
from apps.api.app.schemas import GeoPoint, TurnStep, VehicleTypeEnum

logger = logging.getLogger(__name__)


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great circle distance between two points on earth in kilometers."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


class RawRouteCandidate:
    def __init__(
        self,
        label: str,
        coordinates: List[List[float]],  # [[lat, lng], ...]
        distance_km: float,
        duration_min: float,
        traffic_level: str = "Low",
        traffic_delay_min: float = 0.0,
        has_tolls: bool = False,
        toll_cost_inr: float = 0.0,
        road_quality: str = "Good",
        steps: Optional[List[TurnStep]] = None,
        road_type: str = "arterial",
        vehicle_suitability: Optional[Dict[str, float]] = None
    ):
        self.label = label
        self.coordinates = coordinates
        self.distance_km = distance_km
        self.duration_min = duration_min
        self.traffic_level = traffic_level
        self.traffic_delay_min = traffic_delay_min
        self.has_tolls = has_tolls
        self.toll_cost_inr = toll_cost_inr
        self.road_quality = road_quality
        self.steps = steps or []
        self.road_type = road_type
        self.vehicle_suitability = vehicle_suitability or {}


class BaseRoutingProvider(abc.ABC):
    @abc.abstractmethod
    async def get_routes(
        self,
        origin: GeoPoint,
        destination: GeoPoint,
        waypoints: Optional[List[GeoPoint]] = None,
        vehicle_type: VehicleTypeEnum = VehicleTypeEnum.CAR
    ) -> List[RawRouteCandidate]:
        pass


class OSRMProvider(BaseRoutingProvider):
    """Routing provider using Open Source Routing Machine (OSRM). Free & Open-source."""

    def __init__(self, base_url: Optional[str] = None):
        self.base_url = base_url or settings.OSRM_BASE_URL

    async def get_routes(
        self,
        origin: GeoPoint,
        destination: GeoPoint,
        waypoints: Optional[List[GeoPoint]] = None,
        vehicle_type: VehicleTypeEnum = VehicleTypeEnum.CAR
    ) -> List[RawRouteCandidate]:
        # Coordinates in OSRM URL format: {lng},{lat};{lng},{lat}
        points = [origin] + (waypoints or []) + [destination]
        coords_str = ";".join([f"{p.lng},{p.lat}" for p in points])

        # Attempt vehicle-preferred profile if supported by OSRM backend
        osrm_profile = "bike" if vehicle_type == VehicleTypeEnum.BIKE else "driving"
        url = f"{self.base_url}/route/v1/{osrm_profile}/{coords_str}?overview=full&geometries=geojson&steps=true&alternatives=true"

        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                resp = await client.get(url)
                if resp.status_code != 200 and osrm_profile != "driving":
                    # Fallback to driving profile on OSRM if bike profile unconfigured
                    fallback_url = f"{self.base_url}/route/v1/driving/{coords_str}?overview=full&geometries=geojson&steps=true&alternatives=true"
                    resp = await client.get(fallback_url)

                if resp.status_code == 200:
                    data = resp.json()
                    routes_data = data.get("routes", [])
                    if routes_data:
                        primary_route = routes_data[0]
                        primary_geom = primary_route.get("geometry", {}).get("coordinates", [])
                        primary_coords = [[pt[1], pt[0]] for pt in primary_geom]
                        base_dist = round(primary_route.get("distance", 0) / 1000.0, 2)
                        base_dur = round(primary_route.get("duration", 0) / 60.0, 1)

                        # If OSRM returned fewer than 2 alternatives, attempt an authentic street via-point route
                        if len(routes_data) < 2 and len(primary_coords) > 4:
                            try:
                                mid_idx = len(primary_coords) // 2
                                mid_pt = primary_coords[mid_idx]
                                dx = destination.lng - origin.lng
                                dy = destination.lat - origin.lat
                                mag = math.sqrt(dx * dx + dy * dy)
                                if mag > 1e-5:
                                    offset = min(mag * 0.15, 0.003)
                                    via_lat = mid_pt[0] + (dx / mag) * offset
                                    via_lng = mid_pt[1] - (dy / mag) * offset
                                    via_url = f"{self.base_url}/route/v1/{osrm_profile}/{origin.lng},{origin.lat};{via_lng:.6f},{via_lat:.6f};{destination.lng},{destination.lat}?overview=full&geometries=geojson&steps=true"
                                    via_resp = await client.get(via_url)
                                    if via_resp.status_code == 200:
                                        via_data = via_resp.json()
                                        if via_data.get("routes"):
                                            v_route = via_data["routes"][0]
                                            v_dist = round(v_route.get("distance", 0) / 1000.0, 2)
                                            if v_dist <= base_dist * 1.4:
                                                routes_data.append(v_route)
                            except Exception as via_err:
                                logger.debug(f"OSRM via-point alternative query note: {via_err}")

                        # Build vehicle-tailored candidates strictly from real OSRM coordinates
                        return self._build_vehicle_routes(
                            base_coords=primary_coords,
                            base_dist=base_dist,
                            base_dur=base_dur,
                            origin=origin,
                            destination=destination,
                            vehicle_type=vehicle_type,
                            osrm_routes=routes_data
                        )
        except Exception as e:
            logger.warning(f"OSRM request failed: {e}. Falling back to dynamic route generator.")

        # Fallback to simulated realistic road network
        return SimulatedFallbackRoutingProvider().get_routes_sync(origin, destination, waypoints, vehicle_type)

    def _build_vehicle_routes(
        self,
        base_coords: List[List[float]],
        base_dist: float,
        base_dur: float,
        origin: GeoPoint,
        destination: GeoPoint,
        vehicle_type: VehicleTypeEnum,
        osrm_routes: List[Dict[str, Any]]
    ) -> List[RawRouteCandidate]:
        """Builds realistic, vehicle-tailored route options from real OSRM road geometry."""
        sec_coords = None
        sec_dist = round(base_dist * 1.04, 2)
        sec_dur = round(base_dur * 1.08, 1)

        tert_coords = None
        tert_dist = round(base_dist * 1.08, 2)
        tert_dur = round(base_dur * 1.15, 1)

        if len(osrm_routes) > 1:
            geom1 = osrm_routes[1].get("geometry", {}).get("coordinates", [])
            if len(geom1) > 2:
                sec_coords = [[pt[1], pt[0]] for pt in geom1]
                sec_dist = round(osrm_routes[1].get("distance", 0) / 1000.0, 2)
                sec_dur = round(osrm_routes[1].get("duration", 0) / 60.0, 1)

        if len(osrm_routes) > 2:
            geom2 = osrm_routes[2].get("geometry", {}).get("coordinates", [])
            if len(geom2) > 2:
                tert_coords = [[pt[1], pt[0]] for pt in geom2]
                tert_dist = round(osrm_routes[2].get("distance", 0) / 1000.0, 2)
                tert_dur = round(osrm_routes[2].get("duration", 0) / 60.0, 1)

        # If no separate distinct road was found, use the authentic base road geometry (NEVER draw floating offsets across buildings)
        if not sec_coords:
            sec_coords = list(base_coords)
            sec_dist = base_dist
            sec_dur = round(base_dur * 1.04, 1)
        if not tert_coords:
            tert_coords = list(base_coords)
            tert_dist = base_dist
            tert_dur = round(base_dur * 1.08, 1)

        is_short_trip = base_dist < 4.0

        if is_short_trip:
            # Short local trip (< 4 km) - keep routes tight, realistic and toll-free
            return [
                RawRouteCandidate(
                    label="Route A (Fastest City Direct)",
                    coordinates=base_coords,
                    distance_km=base_dist,
                    duration_min=base_dur,
                    traffic_level="Low",
                    traffic_delay_min=0.5,
                    has_tolls=False,
                    toll_cost_inr=0.0,
                    road_quality="Good",
                    road_type="arterial",
                    vehicle_suitability={"CAR": 98.0, "VAN": 96.0, "BIKE": 95.0, "TRUCK": 85.0},
                    steps=[
                        TurnStep(instruction="Head towards destination along direct street connector", distance_m=round(base_dist * 500), duration_s=round(base_dur * 30), road_name="Main Road"),
                        TurnStep(instruction="Arrive at destination point", distance_m=round(base_dist * 500), duration_s=round(base_dur * 30), road_name="Destination Link")
                    ]
                ),
                RawRouteCandidate(
                    label="Route B (Parallel Street Avenue)",
                    coordinates=sec_coords,
                    distance_km=sec_dist,
                    duration_min=sec_dur,
                    traffic_level="Moderate",
                    traffic_delay_min=1.2,
                    has_tolls=False,
                    toll_cost_inr=0.0,
                    road_quality="Good",
                    road_type="urban",
                    vehicle_suitability={"CAR": 94.0, "VAN": 92.0, "BIKE": 92.0, "TRUCK": 80.0}
                ),
                RawRouteCandidate(
                    label="Route C (Secondary Local Link)",
                    coordinates=tert_coords,
                    distance_km=tert_dist,
                    duration_min=tert_dur,
                    traffic_level="Low",
                    traffic_delay_min=0.8,
                    has_tolls=False,
                    toll_cost_inr=0.0,
                    road_quality="Moderate",
                    road_type="urban",
                    vehicle_suitability={"CAR": 90.0, "VAN": 88.0, "BIKE": 96.0, "TRUCK": 75.0}
                )
            ]

        # Longer trip (>= 4 km)
        if vehicle_type == VehicleTypeEnum.BIKE:
            return [
                RawRouteCandidate(
                    label="Route A (Direct Small Road & Alley Shortcut - Bike Priority)",
                    coordinates=base_coords,
                    distance_km=base_dist,
                    duration_min=base_dur,
                    traffic_level="Low",
                    traffic_delay_min=0.4,
                    has_tolls=False,
                    toll_cost_inr=0.0,
                    road_quality="Good",
                    road_type="urban_narrow",
                    vehicle_suitability={"BIKE": 99.5, "CAR": 62.0, "VAN": 55.0, "BUS": 20.0, "TRUCK": 15.0},
                    steps=[
                        TurnStep(instruction="Turn into local residential alley / small road (avoids vehicular gridlock)", distance_m=round(base_dist * 400), duration_s=round(base_dur * 25), road_name="Neighborhood Lane"),
                        TurnStep(instruction="Proceed straight along dedicated cycle/two-wheeler connector", distance_m=round(base_dist * 400), duration_s=round(base_dur * 25), road_name="Local Link"),
                        TurnStep(instruction="Arrive directly at destination point via small road access", distance_m=round(base_dist * 200), duration_s=round(base_dur * 10), road_name="Destination Access")
                    ]
                ),
                RawRouteCandidate(
                    label="Route B (Green Boulevard / Low Traffic Small Streets)",
                    coordinates=sec_coords,
                    distance_km=sec_dist,
                    duration_min=sec_dur,
                    traffic_level="Low",
                    traffic_delay_min=0.2,
                    has_tolls=False,
                    toll_cost_inr=0.0,
                    road_quality="Good",
                    road_type="residential",
                    vehicle_suitability={"BIKE": 97.0, "CAR": 72.0, "VAN": 65.0, "BUS": 28.0, "TRUCK": 20.0}
                ),
                RawRouteCandidate(
                    label="Route C (Secondary Street Link - Mixed Flow)",
                    coordinates=tert_coords,
                    distance_km=tert_dist,
                    duration_min=tert_dur,
                    traffic_level="Moderate",
                    traffic_delay_min=1.5,
                    has_tolls=False,
                    toll_cost_inr=0.0,
                    road_quality="Good",
                    road_type="urban",
                    vehicle_suitability={"BIKE": 91.0, "CAR": 85.0, "VAN": 80.0, "BUS": 45.0, "TRUCK": 30.0}
                )
            ]

        elif vehicle_type == VehicleTypeEnum.BUS:
            return [
                RawRouteCandidate(
                    label="Route A (Transit Boulevard & High-Clearance Arterial)",
                    coordinates=base_coords,
                    distance_km=base_dist,
                    duration_min=base_dur,
                    traffic_level="Low",
                    traffic_delay_min=1.8,
                    has_tolls=False,
                    toll_cost_inr=0.0,
                    road_quality="Good",
                    road_type="arterial",
                    vehicle_suitability={"BUS": 99.0, "CAR": 92.0, "TRUCK": 90.0, "VAN": 88.0, "BIKE": 40.0},
                    steps=[
                        TurnStep(instruction="Follow wide multi-lane passenger transit boulevard (High overhead clearance)", distance_m=round(base_dist * 500), duration_s=round(base_dur * 30), road_name="Transit Boulevard"),
                        TurnStep(instruction="Stay on primary arterial avenue, avoiding narrow residential side-streets", distance_m=round(base_dist * 350), duration_s=round(base_dur * 20), road_name="Main Arterial"),
                        TurnStep(instruction="Arrive via broad passenger terminal link", distance_m=round(base_dist * 150), duration_s=round(base_dur * 10), road_name="Terminal Connector")
                    ]
                ),
                RawRouteCandidate(
                    label="Route B (Central Bus Corridor - High Capacity)",
                    coordinates=sec_coords,
                    distance_km=sec_dist,
                    duration_min=sec_dur,
                    traffic_level="Moderate",
                    traffic_delay_min=3.5,
                    has_tolls=False,
                    toll_cost_inr=0.0,
                    road_quality="Good",
                    road_type="arterial",
                    vehicle_suitability={"BUS": 93.0, "CAR": 90.0, "TRUCK": 85.0, "VAN": 86.0, "BIKE": 45.0}
                ),
                RawRouteCandidate(
                    label="Route C (Outer Transit Ring Avenue)",
                    coordinates=tert_coords,
                    distance_km=tert_dist,
                    duration_min=tert_dur,
                    traffic_level="Moderate",
                    traffic_delay_min=5.0,
                    has_tolls=True,
                    toll_cost_inr=70.0,
                    road_quality="Good",
                    road_type="bypass",
                    vehicle_suitability={"BUS": 88.0, "CAR": 89.0, "TRUCK": 95.0, "VAN": 84.0, "BIKE": 25.0}
                )
            ]

        elif vehicle_type == VehicleTypeEnum.TRUCK:
            return [
                RawRouteCandidate(
                    label="Route A (Heavy Freight Bypass & Ring Corridor)",
                    coordinates=base_coords,
                    distance_km=base_dist,
                    duration_min=base_dur,
                    traffic_level="Low",
                    traffic_delay_min=1.5,
                    has_tolls=True,
                    toll_cost_inr=110.0,
                    road_quality="Good",
                    road_type="bypass",
                    vehicle_suitability={"TRUCK": 99.0, "BUS": 92.0, "CAR": 88.0, "VAN": 90.0, "BIKE": 15.0},
                    steps=[
                        TurnStep(instruction="Enter heavy commercial freight bypass corridor (No residential weight restriction)", distance_m=round(base_dist * 600), duration_s=round(base_dur * 35), road_name="Freight Bypass"),
                        TurnStep(instruction="Maintain steady cruising speed along outer freight ring road", distance_m=round(base_dist * 300), duration_s=round(base_dur * 20), road_name="Ring Road"),
                        TurnStep(instruction="Take wide commercial industrial exit to destination point", distance_m=round(base_dist * 100), duration_s=round(base_dur * 5), road_name="Industrial Access Link")
                    ]
                ),
                RawRouteCandidate(
                    label="Route B (National Highway Logistics Link)",
                    coordinates=sec_coords,
                    distance_km=sec_dist,
                    duration_min=sec_dur,
                    traffic_level="Moderate",
                    traffic_delay_min=4.2,
                    has_tolls=True,
                    toll_cost_inr=85.0,
                    road_quality="Good",
                    road_type="highway",
                    vehicle_suitability={"TRUCK": 93.0, "BUS": 88.0, "CAR": 90.0, "VAN": 87.0, "BIKE": 20.0}
                ),
                RawRouteCandidate(
                    label="Route C (Commercial Industrial Arterial)",
                    coordinates=tert_coords,
                    distance_km=tert_dist,
                    duration_min=tert_dur,
                    traffic_level="Moderate",
                    traffic_delay_min=6.5,
                    has_tolls=False,
                    toll_cost_inr=0.0,
                    road_quality="Moderate",
                    road_type="urban",
                    vehicle_suitability={"TRUCK": 75.0, "BUS": 78.0, "CAR": 86.0, "VAN": 89.0, "BIKE": 50.0}
                )
            ]

        elif vehicle_type == VehicleTypeEnum.VAN:
            return [
                RawRouteCandidate(
                    label="Route A (Urban Delivery Arterial - Curbside Optimal)",
                    coordinates=base_coords,
                    distance_km=base_dist,
                    duration_min=base_dur,
                    traffic_level="Low",
                    traffic_delay_min=1.2,
                    has_tolls=False,
                    toll_cost_inr=0.0,
                    road_quality="Good",
                    road_type="arterial",
                    vehicle_suitability={"VAN": 98.5, "CAR": 94.0, "BIKE": 86.0, "BUS": 80.0, "TRUCK": 75.0},
                    steps=[
                        TurnStep(instruction="Follow commercial parcel delivery corridor with wide curbside loading", distance_m=round(base_dist * 500), duration_s=round(base_dur * 30), road_name="Commercial Avenue"),
                        TurnStep(instruction="Proceed through urban distribution connector", distance_m=round(base_dist * 350), duration_s=round(base_dur * 20), road_name="Distribution Street"),
                        TurnStep(instruction="Arrive at delivery stop with dedicated van pull-in space", distance_m=round(base_dist * 150), duration_s=round(base_dur * 10), road_name="Service Lane")
                    ]
                ),
                RawRouteCandidate(
                    label="Route B (Commercial Distribution Avenue)",
                    coordinates=sec_coords,
                    distance_km=sec_dist,
                    duration_min=sec_dur,
                    traffic_level="Moderate",
                    traffic_delay_min=2.8,
                    has_tolls=False,
                    toll_cost_inr=0.0,
                    road_quality="Good",
                    road_type="arterial",
                    vehicle_suitability={"VAN": 92.0, "CAR": 92.0, "BIKE": 88.0, "TRUCK": 80.0, "BUS": 82.0}
                ),
                RawRouteCandidate(
                    label="Route C (Secondary Metro Access Link)",
                    coordinates=tert_coords,
                    distance_km=tert_dist,
                    duration_min=tert_dur,
                    traffic_level="Low",
                    traffic_delay_min=1.6,
                    has_tolls=False,
                    toll_cost_inr=0.0,
                    road_quality="Good",
                    road_type="urban",
                    vehicle_suitability={"VAN": 89.0, "CAR": 87.0, "BIKE": 94.0, "TRUCK": 70.0, "BUS": 65.0}
                )
            ]

        else:
            # Default CAR & EV
            return [
                RawRouteCandidate(
                    label="Route A (Fastest Highway / Primary Arterial)",
                    coordinates=base_coords,
                    distance_km=base_dist,
                    duration_min=base_dur,
                    traffic_level="Low",
                    traffic_delay_min=1.0,
                    has_tolls=base_dist > 15.0,
                    toll_cost_inr=50.0 if base_dist > 15.0 else 0.0,
                    road_quality="Good",
                    road_type="highway",
                    vehicle_suitability={"CAR": 98.5, "EV": 94.0, "VAN": 92.0, "TRUCK": 82.0, "BIKE": 35.0},
                    steps=[
                        TurnStep(instruction="Take main city arterial towards flyover ramp", distance_m=round(base_dist * 500), duration_s=round(base_dur * 30), road_name="Main Arterial"),
                        TurnStep(instruction="Continue on express vehicular corridor", distance_m=round(base_dist * 350), duration_s=round(base_dur * 20), road_name="Flyover Expressway"),
                        TurnStep(instruction="Take ramp exit towards destination point", distance_m=round(base_dist * 150), duration_s=round(base_dur * 10), road_name="Destination Link")
                    ]
                ),
                RawRouteCandidate(
                    label="Route B (City Center Arterial - Toll Free)",
                    coordinates=sec_coords,
                    distance_km=sec_dist,
                    duration_min=sec_dur,
                    traffic_level="Moderate",
                    traffic_delay_min=3.2,
                    has_tolls=False,
                    toll_cost_inr=0.0,
                    road_quality="Good",
                    road_type="arterial",
                    vehicle_suitability={"CAR": 94.0, "EV": 96.0, "VAN": 90.0, "TRUCK": 75.0, "BIKE": 70.0}
                ),
                RawRouteCandidate(
                    label="Route C (Inner Ring Road Bypass)",
                    coordinates=tert_coords,
                    distance_km=tert_dist,
                    duration_min=tert_dur,
                    traffic_level="Low",
                    traffic_delay_min=1.5,
                    has_tolls=False,
                    toll_cost_inr=0.0,
                    road_quality="Good",
                    road_type="bypass",
                    vehicle_suitability={"CAR": 91.0, "EV": 89.0, "VAN": 92.0, "TRUCK": 88.0, "BIKE": 40.0}
                )
            ]

    def _synthesize_corridor(
        self,
        base_coords: List[List[float]],
        origin: GeoPoint,
        destination: GeoPoint,
        offset_ratio: float = 0.030
    ) -> List[List[float]]:
        """Preserves authentic road network geometry."""
        return list(base_coords)


class SimulatedFallbackRoutingProvider(BaseRoutingProvider):
    """Generates realistic synthetic routes when network is offline."""

    async def get_routes(
        self,
        origin: GeoPoint,
        destination: GeoPoint,
        waypoints: Optional[List[GeoPoint]] = None,
        vehicle_type: VehicleTypeEnum = VehicleTypeEnum.CAR
    ) -> List[RawRouteCandidate]:
        return self.get_routes_sync(origin, destination, waypoints, vehicle_type)

    def get_routes_sync(
        self,
        origin: GeoPoint,
        destination: GeoPoint,
        waypoints: Optional[List[GeoPoint]] = None,
        vehicle_type: VehicleTypeEnum = VehicleTypeEnum.CAR
    ) -> List[RawRouteCandidate]:
        base_dist = haversine_distance(origin.lat, origin.lng, destination.lat, destination.lng) * 1.3
        base_dist = max(base_dist, 2.0)

        if vehicle_type == VehicleTypeEnum.TRUCK:
            # Outer Ring Bypass (Freight optimal)
            coords_a = self._generate_polyline(origin, destination, curvature=0.052, points=40)
            coords_b = self._generate_polyline(origin, destination, curvature=0.026, points=35)
            coords_c = self._generate_polyline(origin, destination, curvature=0.005, points=30)
            return [
                RawRouteCandidate(
                    label="Route A (Outer Ring Road / Freight Bypass Corridor)",
                    coordinates=coords_a,
                    distance_km=round(base_dist * 1.15, 2),
                    duration_min=round((base_dist * 1.15 / 48.0) * 60.0, 1),
                    traffic_level="Low",
                    traffic_delay_min=1.2,
                    has_tolls=True,
                    toll_cost_inr=140.0,
                    road_quality="Good",
                    road_type="bypass",
                    vehicle_suitability={"TRUCK": 99.0, "BUS": 92.0, "CAR": 88.0, "BIKE": 15.0}
                ),
                RawRouteCandidate(
                    label="Route B (National Highway Freight Link)",
                    coordinates=coords_b,
                    distance_km=round(base_dist * 1.08, 2),
                    duration_min=round((base_dist * 1.08 / 42.0) * 60.0, 1),
                    traffic_level="Moderate",
                    traffic_delay_min=5.5,
                    has_tolls=True,
                    toll_cost_inr=95.0,
                    road_quality="Good",
                    road_type="highway",
                    vehicle_suitability={"TRUCK": 93.0, "BUS": 86.0, "CAR": 90.0, "BIKE": 20.0}
                ),
                RawRouteCandidate(
                    label="Route C (Commercial Industrial Arterial)",
                    coordinates=coords_c,
                    distance_km=round(base_dist * 0.98, 2),
                    duration_min=round((base_dist * 0.98 / 26.0) * 60.0 + 12.0, 1),
                    traffic_level="High",
                    traffic_delay_min=12.0,
                    has_tolls=False,
                    toll_cost_inr=0.0,
                    road_quality="Moderate",
                    road_type="urban",
                    vehicle_suitability={"TRUCK": 75.0, "BUS": 78.0, "CAR": 84.0, "BIKE": 50.0}
                )
            ]

        elif vehicle_type == VehicleTypeEnum.BUS:
            # Transit Boulevards (High clearance, wide passenger corridors)
            coords_a = self._generate_polyline(origin, destination, curvature=0.018, points=38)
            coords_b = self._generate_polyline(origin, destination, curvature=-0.022, points=36)
            coords_c = self._generate_polyline(origin, destination, curvature=0.045, points=40)
            return [
                RawRouteCandidate(
                    label="Route A (Transit Boulevard & High-Clearance Arterial)",
                    coordinates=coords_a,
                    distance_km=round(base_dist * 1.04, 2),
                    duration_min=round((base_dist * 1.04 / 36.0) * 60.0, 1),
                    traffic_level="Low",
                    traffic_delay_min=1.5,
                    has_tolls=False,
                    toll_cost_inr=0.0,
                    road_quality="Good",
                    road_type="arterial",
                    vehicle_suitability={"BUS": 99.0, "CAR": 92.0, "TRUCK": 88.0, "BIKE": 35.0}
                ),
                RawRouteCandidate(
                    label="Route B (Central Bus Corridor - Wide Multi-Lane)",
                    coordinates=coords_b,
                    distance_km=round(base_dist * 1.08, 2),
                    duration_min=round((base_dist * 1.08 / 32.0) * 60.0, 1),
                    traffic_level="Moderate",
                    traffic_delay_min=3.0,
                    has_tolls=False,
                    toll_cost_inr=0.0,
                    road_quality="Good",
                    road_type="arterial",
                    vehicle_suitability={"BUS": 94.0, "CAR": 90.0, "TRUCK": 82.0, "BIKE": 40.0}
                ),
                RawRouteCandidate(
                    label="Route C (Expressway Transit Connector)",
                    coordinates=coords_c,
                    distance_km=round(base_dist * 1.18, 2),
                    duration_min=round((base_dist * 1.18 / 48.0) * 60.0, 1),
                    traffic_level="Low",
                    traffic_delay_min=1.0,
                    has_tolls=True,
                    toll_cost_inr=65.0,
                    road_quality="Good",
                    road_type="highway",
                    vehicle_suitability={"BUS": 88.0, "CAR": 94.0, "TRUCK": 92.0, "BIKE": 20.0}
                )
            ]

        elif vehicle_type == VehicleTypeEnum.VAN:
            # Commercial parcel delivery corridors
            coords_a = self._generate_polyline(origin, destination, curvature=0.015, points=36)
            coords_b = self._generate_polyline(origin, destination, curvature=-0.018, points=34)
            coords_c = self._generate_polyline(origin, destination, curvature=0.035, points=38)
            return [
                RawRouteCandidate(
                    label="Route A (Urban Delivery Arterial - Curbside Optimal)",
                    coordinates=coords_a,
                    distance_km=round(base_dist * 1.0, 2),
                    duration_min=round((base_dist / 40.0) * 60.0, 1),
                    traffic_level="Low",
                    traffic_delay_min=1.2,
                    has_tolls=False,
                    toll_cost_inr=0.0,
                    road_quality="Good",
                    road_type="arterial",
                    vehicle_suitability={"VAN": 98.5, "CAR": 94.0, "BIKE": 86.0, "TRUCK": 78.0}
                ),
                RawRouteCandidate(
                    label="Route B (Commercial Distribution Avenue)",
                    coordinates=coords_b,
                    distance_km=round(base_dist * 1.05, 2),
                    duration_min=round((base_dist * 1.05 / 35.0) * 60.0, 1),
                    traffic_level="Moderate",
                    traffic_delay_min=2.5,
                    has_tolls=False,
                    toll_cost_inr=0.0,
                    road_quality="Good",
                    road_type="arterial",
                    vehicle_suitability={"VAN": 93.0, "CAR": 91.0, "BIKE": 88.0, "TRUCK": 80.0}
                ),
                RawRouteCandidate(
                    label="Route C (Secondary Metro Access Link)",
                    coordinates=coords_c,
                    distance_km=round(base_dist * 1.12, 2),
                    duration_min=round((base_dist * 1.12 / 32.0) * 60.0, 1),
                    traffic_level="Low",
                    traffic_delay_min=1.0,
                    has_tolls=False,
                    toll_cost_inr=0.0,
                    road_quality="Good",
                    road_type="urban",
                    vehicle_suitability={"VAN": 90.0, "CAR": 87.0, "BIKE": 94.0, "TRUCK": 70.0}
                )
            ]

        elif vehicle_type == VehicleTypeEnum.BIKE:
            # Direct Urban Shortcut (Bike optimal, small roads, alleys, cuts)
            coords_a = self._generate_polyline(origin, destination, curvature=0.005, points=35)
            coords_b = self._generate_polyline(origin, destination, curvature=-0.015, points=36)
            coords_c = self._generate_polyline(origin, destination, curvature=0.040, points=38)
            return [
                RawRouteCandidate(
                    label="Route A (Direct Small Road & Alley Shortcut - Bike Priority)",
                    coordinates=coords_a,
                    distance_km=round(base_dist * 0.90, 2),
                    duration_min=round((base_dist * 0.90 / 22.0) * 60.0, 1),
                    traffic_level="Low",
                    traffic_delay_min=0.3,
                    has_tolls=False,
                    toll_cost_inr=0.0,
                    road_quality="Good",
                    road_type="urban_narrow",
                    vehicle_suitability={"BIKE": 99.5, "CAR": 60.0, "VAN": 52.0, "BUS": 20.0, "TRUCK": 15.0}
                ),
                RawRouteCandidate(
                    label="Route B (Neighborhood Green Corridor - Small Streets)",
                    coordinates=coords_b,
                    distance_km=round(base_dist * 0.98, 2),
                    duration_min=round((base_dist * 0.98 / 24.0) * 60.0, 1),
                    traffic_level="Low",
                    traffic_delay_min=0.2,
                    has_tolls=False,
                    toll_cost_inr=0.0,
                    road_quality="Good",
                    road_type="residential",
                    vehicle_suitability={"BIKE": 97.0, "CAR": 72.0, "VAN": 65.0, "BUS": 25.0, "TRUCK": 20.0}
                ),
                RawRouteCandidate(
                    label="Route C (Secondary Street Link - Mixed Flow)",
                    coordinates=coords_c,
                    distance_km=round(base_dist * 1.05, 2),
                    duration_min=round((base_dist * 1.05 / 26.0) * 60.0, 1),
                    traffic_level="Moderate",
                    traffic_delay_min=1.2,
                    has_tolls=False,
                    toll_cost_inr=0.0,
                    road_quality="Good",
                    road_type="urban",
                    vehicle_suitability={"BIKE": 92.0, "CAR": 85.0, "VAN": 80.0, "BUS": 40.0, "TRUCK": 30.0}
                )
            ]

        elif vehicle_type == VehicleTypeEnum.EV:
            coords_a = self._generate_polyline(origin, destination, curvature=-0.022, points=38)
            coords_b = self._generate_polyline(origin, destination, curvature=0.038, points=40)
            coords_c = self._generate_polyline(origin, destination, curvature=0.006, points=32)
            return [
                RawRouteCandidate(
                    label="Route A (Green Eco-Arterial - Regen Optimal)",
                    coordinates=coords_a,
                    distance_km=round(base_dist * 1.02, 2),
                    duration_min=round((base_dist * 1.02 / 52.0) * 60.0, 1),
                    traffic_level="Low",
                    traffic_delay_min=1.5,
                    has_tolls=False,
                    toll_cost_inr=0.0,
                    road_quality="Good",
                    road_type="arterial",
                    vehicle_suitability={"EV": 98.0, "CAR": 90.0, "BIKE": 92.0}
                ),
                RawRouteCandidate(
                    label="Route B (Expressway Fast-Charging Corridor)",
                    coordinates=coords_b,
                    distance_km=round(base_dist * 1.08, 2),
                    duration_min=round((base_dist * 1.08 / 68.0) * 60.0, 1),
                    traffic_level="Moderate",
                    traffic_delay_min=3.5,
                    has_tolls=True,
                    toll_cost_inr=60.0,
                    road_quality="Good",
                    road_type="highway",
                    vehicle_suitability={"EV": 86.0, "CAR": 96.0, "TRUCK": 90.0}
                ),
                RawRouteCandidate(
                    label="Route C (Urban Battery-Saver Connector)",
                    coordinates=coords_c,
                    distance_km=round(base_dist * 1.15, 2),
                    duration_min=round((base_dist * 1.15 / 45.0) * 60.0, 1),
                    traffic_level="Low",
                    traffic_delay_min=1.0,
                    has_tolls=False,
                    toll_cost_inr=0.0,
                    road_quality="Good",
                    road_type="urban",
                    vehicle_suitability={"EV": 89.0, "CAR": 85.0, "TRUCK": 88.0}
                )
            ]

        else:
            # Default CAR
            coords_a = self._generate_polyline(origin, destination, curvature=0.022, points=35)
            coords_b = self._generate_polyline(origin, destination, curvature=-0.016, points=36)
            coords_c = self._generate_polyline(origin, destination, curvature=0.050, points=38)
            return [
                RawRouteCandidate(
                    label="Route A (Express Highway & Elevated Flyover)",
                    coordinates=coords_a,
                    distance_km=round(base_dist, 2),
                    duration_min=round((base_dist / 65.0) * 60.0, 1),
                    traffic_level="Low",
                    traffic_delay_min=2.0,
                    has_tolls=True,
                    toll_cost_inr=60.0,
                    road_quality="Good",
                    road_type="highway",
                    vehicle_suitability={"CAR": 98.0, "EV": 88.0, "TRUCK": 88.0, "BIKE": 25.0}
                ),
                RawRouteCandidate(
                    label="Route B (City Arterial Avenue - Toll Free)",
                    coordinates=coords_b,
                    distance_km=round(base_dist * 0.98, 2),
                    duration_min=round((base_dist * 0.98 / 42.0) * 60.0, 1),
                    traffic_level="Moderate",
                    traffic_delay_min=6.5,
                    has_tolls=False,
                    toll_cost_inr=0.0,
                    road_quality="Good",
                    road_type="arterial",
                    vehicle_suitability={"CAR": 94.0, "EV": 94.0, "BIKE": 88.0, "TRUCK": 75.0}
                ),
                RawRouteCandidate(
                    label="Route C (Outer Ring Road Bypass)",
                    coordinates=coords_c,
                    distance_km=round(base_dist * 1.15, 2),
                    duration_min=round((base_dist * 1.15 / 55.0) * 60.0, 1),
                    traffic_level="Low",
                    traffic_delay_min=1.0,
                    has_tolls=True,
                    toll_cost_inr=80.0,
                    road_quality="Good",
                    road_type="bypass",
                    vehicle_suitability={"CAR": 90.0, "TRUCK": 98.0, "VAN": 91.0, "BIKE": 25.0}
                )
            ]

    def _generate_polyline(
        self,
        p1: GeoPoint,
        p2: GeoPoint,
        curvature: float = 0.02,
        points: int = 30
    ) -> List[List[float]]:
        coords = []
        dx = p2.lng - p1.lng
        dy = p2.lat - p1.lat
        length = math.sqrt(dx * dx + dy * dy) or 1.0
        nx = -dy / length
        ny = dx / length

        for i in range(points):
            t = i / float(points - 1)
            # Cubic easing curve
            mid_curve = math.sin(t * math.pi)
            jitter = math.sin(t * 8 * math.pi) * (curvature * 0.15)
            lat = p1.lat + t * dy + (ny * curvature * mid_curve) + jitter
            lng = p1.lng + t * dx + (nx * curvature * mid_curve) + jitter
            coords.append([round(lat, 6), round(lng, 6)])

        return coords


def decode_google_polyline(polyline_str: str) -> List[List[float]]:
    """Decode an encoded Google Maps Polyline string into a list of [lat, lng] points."""
    index, lat, lng = 0, 0, 0
    coordinates = []
    length = len(polyline_str)
    while index < length:
        shift, result = 0, 0
        while True:
            byte = ord(polyline_str[index]) - 63
            index += 1
            result |= (byte & 0x1f) << shift
            shift += 5
            if byte < 0x20:
                break
        dlat = ~(result >> 1) if (result & 1) else (result >> 1)
        lat += dlat

        shift, result = 0, 0
        while True:
            byte = ord(polyline_str[index]) - 63
            index += 1
            result |= (byte & 0x1f) << shift
            shift += 5
            if byte < 0x20:
                break
        dlng = ~(result >> 1) if (result & 1) else (result >> 1)
        lng += dlng

        coordinates.append([round(lat / 1e5, 6), round(lng / 1e5, 6)])
    return coordinates


class GoogleMapsRoutingProvider(BaseRoutingProvider):
    """Accurate Commercial Routing Provider using Google Maps Directions API."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.GOOGLE_MAPS_API_KEY

    async def get_routes(
        self,
        origin: GeoPoint,
        destination: GeoPoint,
        waypoints: Optional[List[GeoPoint]] = None,
        vehicle_type: VehicleTypeEnum = VehicleTypeEnum.CAR
    ) -> List[RawRouteCandidate]:
        if not self.api_key:
            logger.warning("GOOGLE_MAPS_API_KEY missing, falling back to OSRM")
            return await OSRMProvider().get_routes(origin, destination, waypoints, vehicle_type)

        origin_str = f"{origin.lat},{origin.lng}"
        dest_str = f"{destination.lat},{destination.lng}"
        params: Dict[str, Any] = {
            "origin": origin_str,
            "destination": dest_str,
            "alternatives": "true",
            "mode": "driving",
            "departure_time": "now",
            "key": self.api_key,
        }

        if waypoints and len(waypoints) > 0:
            wp_str = "|".join([f"{wp.lat},{wp.lng}" for wp in waypoints])
            params["waypoints"] = wp_str

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.get("https://maps.googleapis.com/maps/api/directions/json", params=params)
                if res.status_code == 200:
                    data = res.json()
                    if data.get("status") == "OK" and data.get("routes"):
                        candidates = []
                        routes_data = data.get("routes", [])

                        for idx, r in enumerate(routes_data):
                            overview_poly = r.get("overview_polyline", {}).get("points", "")
                            coords = decode_google_polyline(overview_poly) if overview_poly else []
                            summary = r.get("summary") or f"Google Route {idx + 1}"
                            legs = r.get("legs", [])

                            total_distance_m = sum(leg.get("distance", {}).get("value", 0) for leg in legs)
                            total_duration_s = sum(
                                leg.get("duration_in_traffic", {}).get("value") or leg.get("duration", {}).get("value", 0)
                                for leg in legs
                            )
                            normal_duration_s = sum(leg.get("duration", {}).get("value", 0) for leg in legs)
                            delay_min = max(0.0, round((total_duration_s - normal_duration_s) / 60.0, 1))

                            distance_km = round(total_distance_m / 1000.0, 2)
                            duration_min = round(total_duration_s / 60.0, 1)

                            # Parse detailed turn steps
                            steps: List[TurnStep] = []
                            for leg in legs:
                                for s in leg.get("steps", []):
                                    html_inst = s.get("html_instructions", "")
                                    # Strip basic html tags
                                    import re
                                    clean_inst = re.sub('<[^<]+?>', '', html_inst)
                                    s_dist = s.get("distance", {}).get("value", 0)
                                    s_dur = s.get("duration", {}).get("value", 0)
                                    steps.append(
                                        TurnStep(
                                            instruction=clean_inst or "Continue straight",
                                            distance_m=s_dist,
                                            duration_s=s_dur,
                                            road_name=summary
                                        )
                                    )

                            warnings = r.get("warnings", [])
                            has_tolls = any("toll" in str(w).lower() for w in warnings) or "toll" in summary.lower()

                            # Determine traffic level
                            if delay_min > 10.0:
                                traffic_level = "High"
                            elif delay_min > 3.0:
                                traffic_level = "Moderate"
                            else:
                                traffic_level = "Low"

                            label = f"{summary} ({'Fastest' if idx == 0 else f'Alt {idx}'})"
                            if has_tolls:
                                label += " • Tolls"

                            candidates.append(
                                RawRouteCandidate(
                                    label=label,
                                    coordinates=coords,
                                    distance_km=distance_km,
                                    duration_min=duration_min,
                                    traffic_level=traffic_level,
                                    traffic_delay_min=delay_min,
                                    has_tolls=has_tolls,
                                    toll_cost_inr=50.0 if has_tolls else 0.0,
                                    road_quality="Good",
                                    steps=steps,
                                    road_type="highway" if "highway" in summary.lower() or "expressway" in summary.lower() else "arterial",
                                    vehicle_suitability={"CAR": 98.0, "EV": 95.0, "TRUCK": 92.0, "BIKE": 88.0}
                                )
                            )

                        if candidates:
                            return candidates
                    else:
                        logger.warning(f"Google Maps Directions API status: {data.get('status')}, error: {data.get('error_message')}")
        except Exception as e:
            logger.error(f"Google Maps routing error: {e}")

        # Fallback to OSRM / simulation if Google API fails
        return await OSRMProvider().get_routes(origin, destination, waypoints, vehicle_type)


def get_routing_provider() -> BaseRoutingProvider:
    if settings.ROUTING_PROVIDER == "google" or settings.GOOGLE_MAPS_API_KEY:
        return GoogleMapsRoutingProvider()
    if settings.ROUTING_PROVIDER == "osrm":
        return OSRMProvider()
    return SimulatedFallbackRoutingProvider()
