import abc
from typing import List, Optional
import httpx
import logging

from apps.api.app.core.config import settings
from apps.api.app.schemas import GeoPoint

logger = logging.getLogger(__name__)


class BaseGeocodingProvider(abc.ABC):
    @abc.abstractmethod
    async def search(self, query: str, limit: int = 5) -> List[GeoPoint]:
        pass

    @abc.abstractmethod
    async def reverse(self, lat: float, lng: float) -> Optional[str]:
        pass


class HybridProductionGeocodingProvider(BaseGeocodingProvider):
    """Production-grade geocoding engine with multi-source fallback (Photon, Nominatim, Curated Hubs) and caching."""

    def __init__(self, base_url: Optional[str] = None):
        self.base_url = base_url or settings.NOMINATIM_BASE_URL
        self.photon_url = "https://photon.komoot.io"
        self.headers = {"User-Agent": "AeroRoutePlatform/2.0 (route-intelligence@ausorum.ai)"}
        self._search_cache: dict = {}
        self._reverse_cache: dict = {}

    async def search(self, query: str, limit: int = 6) -> List[GeoPoint]:
        if not query or len(query.strip()) < 2:
            return []

        clean_query = query.strip()
        cache_key = f"{clean_query.lower()}_{limit}"
        if cache_key in self._search_cache:
            return self._search_cache[cache_key]

        # 1. Try Photon (Ultra-fast OSM-based geocoder with rich structured fields)
        try:
            async with httpx.AsyncClient(timeout=3.5) as client:
                resp = await client.get(
                    f"{self.photon_url}/api/?q={clean_query}&limit={limit}",
                    headers=self.headers
                )
                if resp.status_code == 200:
                    data = resp.json()
                    features = data.get("features", [])
                    if features:
                        results: List[GeoPoint] = []
                        for feat in features:
                            props = feat.get("properties", {})
                            geom = feat.get("geometry", {})
                            coords = geom.get("coordinates", [])
                            if len(coords) < 2:
                                continue
                            lon, lat = coords[0], coords[1]
                            
                            name = props.get("name") or props.get("street") or clean_query
                            city = props.get("city") or props.get("county") or props.get("district")
                            state = props.get("state")
                            country = props.get("country")
                            
                            addr_parts = [p for p in [name, city, state, country] if p]
                            full_addr = ", ".join(addr_parts) if addr_parts else name

                            results.append(GeoPoint(
                                lat=round(float(lat), 6),
                                lng=round(float(lon), 6),
                                address=full_addr,
                                name=name,
                                city=city,
                                state=state,
                                country=country
                            ))

                        if results:
                            self._search_cache[cache_key] = results
                            return results
        except Exception as e:
            logger.debug(f"Photon geocode search notice: {e}")

        # 2. Fallback to OpenStreetMap Nominatim
        try:
            url = f"{self.base_url}/search?q={clean_query}&format=json&addressdetails=1&limit={limit}"
            async with httpx.AsyncClient(timeout=3.5) as client:
                resp = await client.get(url, headers=self.headers)
                if resp.status_code == 200:
                    nom_results = resp.json()
                    if nom_results:
                        points: List[GeoPoint] = []
                        for item in nom_results:
                            addr_detail = item.get("address", {})
                            name = (
                                item.get("name")
                                or addr_detail.get("road")
                                or addr_detail.get("suburb")
                                or addr_detail.get("city")
                                or clean_query
                            )
                            city = addr_detail.get("city") or addr_detail.get("town") or addr_detail.get("county")
                            state = addr_detail.get("state")
                            country = addr_detail.get("country")

                            points.append(GeoPoint(
                                lat=round(float(item.get("lat")), 6),
                                lng=round(float(item.get("lon")), 6),
                                address=item.get("display_name", clean_query),
                                name=name,
                                city=city,
                                state=state,
                                country=country
                            ))
                        if points:
                            self._search_cache[cache_key] = points
                            return points
        except Exception as e:
            logger.warning(f"Nominatim search failed: {e}")

        # 3. High-Density Offline Landmark & City Directory
        query_lower = clean_query.lower()
        known_places = [
            ("pune railway station", 18.5284, 73.8744, "Pune Railway Station, Somwar Peth, Pune, Maharashtra", "Pune Railway Station", "Pune", "Maharashtra", "India"),
            ("pune airport", 18.5821, 73.9197, "Pune International Airport (PNQ), Lohegaon, Pune, Maharashtra", "Pune International Airport", "Pune", "Maharashtra", "India"),
            ("hinjawadi", 18.5913, 73.7389, "Hinjawadi Rajiv Gandhi Infotech Park, Pune, Maharashtra", "Hinjawadi IT Park", "Pune", "Maharashtra", "India"),
            ("shivajinagar", 18.5314, 73.8446, "Shivajinagar Bus & Rail Terminus, Pune, Maharashtra", "Shivajinagar", "Pune", "Maharashtra", "India"),
            ("kothrud", 18.5074, 73.8077, "Kothrud, Pune, Maharashtra, India", "Kothrud", "Pune", "Maharashtra", "India"),
            ("hadapsar", 18.5089, 73.9260, "Hadapsar Magarpatta City, Pune, Maharashtra", "Magarpatta City", "Pune", "Maharashtra", "India"),
            ("viman nagar", 18.5679, 73.9143, "Viman Nagar, Pune, Maharashtra, India", "Viman Nagar", "Pune", "Maharashtra", "India"),
            ("baner", 18.5590, 73.7868, "Baner Road, Pune, Maharashtra, India", "Baner", "Pune", "Maharashtra", "India"),
            ("wakad", 18.5987, 73.7667, "Wakad, Pimpri-Chinchwad, Maharashtra", "Wakad", "Pune", "Maharashtra", "India"),
            ("pimpri", 18.6279, 73.8009, "Pimpri Chinchwad MIDC Industrial Area, Maharashtra", "Pimpri MIDC", "Pimpri-Chinchwad", "Maharashtra", "India"),
            ("mumbai cst", 18.9401, 72.8354, "Chhatrapati Shivaji Maharaj Terminus (CSMT), Fort, Mumbai", "CSMT Mumbai", "Mumbai", "Maharashtra", "India"),
            ("mumbai airport", 19.0896, 72.8656, "Chhatrapati Shivaji Maharaj International Airport (BOM), Mumbai", "Mumbai Airport (BOM)", "Mumbai", "Maharashtra", "India"),
            ("bandra kurla complex", 19.0662, 72.8679, "Bandra Kurla Complex (BKC), Mumbai, Maharashtra", "BKC", "Mumbai", "Maharashtra", "India"),
            ("navi mumbai", 19.0330, 73.0297, "Navi Mumbai, Maharashtra, India", "Navi Mumbai", "Navi Mumbai", "Maharashtra", "India"),
            ("bengaluru airport", 13.1986, 77.7066, "Kempegowda International Airport (BLR), Bengaluru, Karnataka", "Kempegowda Airport (BLR)", "Bengaluru", "Karnataka", "India"),
            ("bengaluru", 12.9716, 77.5946, "Bengaluru Central, Karnataka, India", "Bengaluru", "Bengaluru", "Karnataka", "India"),
            ("electronic city", 12.8399, 77.6770, "Electronic City Phase 1, Bengaluru, Karnataka", "Electronic City", "Bengaluru", "Karnataka", "India"),
            ("delhi airport", 28.5562, 77.1000, "Indira Gandhi International Airport (DEL), New Delhi", "IGI Airport (DEL)", "New Delhi", "Delhi", "India"),
            ("connaught place", 28.6315, 77.2167, "Connaught Place, New Delhi, Delhi, India", "Connaught Place", "New Delhi", "Delhi", "India"),
            ("hyderabad", 17.3850, 78.4867, "Hyderabad Central, Telangana, India", "Hyderabad", "Hyderabad", "Telangana", "India"),
            ("hitec city", 17.4474, 78.3762, "HITEC City, Madhapur, Hyderabad, Telangana", "HITEC City", "Hyderabad", "Telangana", "India"),
            ("chennai", 13.0827, 80.2707, "Chennai Central, Tamil Nadu, India", "Chennai", "Chennai", "Tamil Nadu", "India"),
        ]

        matches: List[GeoPoint] = []
        for key, lat, lng, full_addr, name, city, state, country in known_places:
            if key in query_lower or query_lower in key:
                matches.append(GeoPoint(
                    lat=lat,
                    lng=lng,
                    address=full_addr,
                    name=name,
                    city=city,
                    state=state,
                    country=country
                ))

        if matches:
            return matches[:limit]

        # If no external geocoder or known place matched, return empty so frontend prompts map selection
        return []

    async def reverse(self, lat: float, lng: float) -> Optional[str]:
        cache_key = f"{round(lat, 4)}_{round(lng, 4)}"
        if cache_key in self._reverse_cache:
            return self._reverse_cache[cache_key]

        # 1. Photon Reverse
        try:
            async with httpx.AsyncClient(timeout=3.5) as client:
                resp = await client.get(
                    f"{self.photon_url}/reverse?lat={lat}&lon={lng}",
                    headers=self.headers
                )
                if resp.status_code == 200:
                    data = resp.json()
                    features = data.get("features", [])
                    if features:
                        props = features[0].get("properties", {})
                        parts = [
                            props.get("name") or props.get("street"),
                            props.get("district") or props.get("suburb"),
                            props.get("city") or props.get("county"),
                            props.get("state"),
                            props.get("country")
                        ]
                        valid_parts = [p for p in parts if p]
                        if valid_parts:
                            formatted = ", ".join(valid_parts[:3])
                            self._reverse_cache[cache_key] = formatted
                            return formatted
        except Exception as e:
            logger.debug(f"Photon reverse notice: {e}")

        # 2. Nominatim Reverse
        try:
            url = f"{self.base_url}/reverse?lat={lat}&lon={lng}&format=json"
            async with httpx.AsyncClient(timeout=3.5) as client:
                resp = await client.get(url, headers=self.headers)
                if resp.status_code == 200:
                    data = resp.json()
                    addr = data.get("display_name")
                    if addr:
                        # Clean up excessively verbose strings
                        short_addr = ", ".join(addr.split(",")[:4]).strip()
                        self._reverse_cache[cache_key] = short_addr
                        return short_addr
        except Exception as e:
            logger.warning(f"Nominatim reverse failed: {e}")

        fallback = f"Pinned Location ({round(lat, 4)}, {round(lng, 4)})"
        self._reverse_cache[cache_key] = fallback
        return fallback


def get_geocoding_provider() -> BaseGeocodingProvider:
    return HybridProductionGeocodingProvider()

