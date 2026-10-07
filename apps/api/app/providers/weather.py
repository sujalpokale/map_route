import abc
from typing import Dict, Any, Optional
import httpx
import logging

logger = logging.getLogger(__name__)


class WeatherData:
    def __init__(
        self,
        condition: str,
        temperature_c: float,
        precipitation_mm: float,
        wind_speed_kmh: float,
        visibility_km: float,
        weather_score: float  # 0 to 100
    ):
        self.condition = condition
        self.temperature_c = temperature_c
        self.precipitation_mm = precipitation_mm
        self.wind_speed_kmh = wind_speed_kmh
        self.visibility_km = visibility_km
        self.weather_score = weather_score

    def to_dict(self) -> Dict[str, Any]:
        return {
            "condition": self.condition,
            "temperature_c": self.temperature_c,
            "precipitation_mm": self.precipitation_mm,
            "wind_speed_kmh": self.wind_speed_kmh,
            "visibility_km": self.visibility_km,
            "weather_score": self.weather_score
        }


class BaseWeatherProvider(abc.ABC):
    @abc.abstractmethod
    async def get_weather(self, lat: float, lng: float) -> WeatherData:
        pass


class OpenMeteoWeatherProvider(BaseWeatherProvider):
    """Free weather provider using Open-Meteo public API."""

    WEATHER_CODE_MAP = {
        0: ("Clear", 98.0),
        1: ("Mainly Clear", 95.0),
        2: ("Partly Cloudy", 90.0),
        3: ("Overcast", 85.0),
        45: ("Fog", 60.0),
        48: ("Depositing Rime Fog", 55.0),
        51: ("Light Drizzle", 75.0),
        53: ("Moderate Drizzle", 70.0),
        55: ("Dense Drizzle", 65.0),
        61: ("Slight Rain", 70.0),
        63: ("Moderate Rain", 55.0),
        65: ("Heavy Rain", 40.0),
        71: ("Slight Snow", 50.0),
        80: ("Rain Showers", 55.0),
        81: ("Moderate Showers", 45.0),
        82: ("Violent Showers", 30.0),
        95: ("Thunderstorm", 25.0),
        96: ("Thunderstorm with Hail", 15.0),
    }

    async def get_weather(self, lat: float, lng: float) -> WeatherData:
        url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lng}&current=temperature_2m,precipitation,weather_code,wind_speed_10m"
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    current = data.get("current", {})
                    wcode = current.get("weather_code", 0)
                    temp = current.get("temperature_2m", 26.0)
                    precip = current.get("precipitation", 0.0)
                    wind = current.get("wind_speed_10m", 12.0)

                    cond, score = self.WEATHER_CODE_MAP.get(wcode, ("Fair", 80.0))
                    # Adjust visibility
                    vis = 10.0 if precip == 0 else max(10.0 - (precip * 1.5), 1.5)

                    return WeatherData(
                        condition=cond,
                        temperature_c=float(temp),
                        precipitation_mm=float(precip),
                        wind_speed_kmh=float(wind),
                        visibility_km=round(vis, 1),
                        weather_score=score
                    )
        except Exception as e:
            logger.warning(f"Open-Meteo request failed: {e}. Weather data is unavailable.")

        return WeatherData(
            condition="Unavailable",
            temperature_c=0.0,
            precipitation_mm=0.0,
            wind_speed_kmh=0.0,
            visibility_km=0.0,
            weather_score=50.0
        )


def get_weather_provider() -> BaseWeatherProvider:
    return OpenMeteoWeatherProvider()
