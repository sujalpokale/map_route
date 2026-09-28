from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False
    )

    APP_NAME: str = "Route Intelligence Platform"
    APP_ENV: str = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"
    SECRET_KEY: str = "dev_secret_key_change_in_production_super_secret_jwt_key_98234"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./route_platform.db"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Routing Providers
    ROUTING_PROVIDER: str = "osrm"  # osrm | mapbox | google | simulation
    OSRM_BASE_URL: str = "https://router.project-osrm.org"
    NOMINATIM_BASE_URL: str = "https://nominatim.openstreetmap.org"
    MAPBOX_ACCESS_TOKEN: str = ""
    GOOGLE_MAPS_API_KEY: str = ""
    CARTO_API_KEY: str = ""
    NEXT_PUBLIC_CARTO_API_KEY: str = ""
    MAPTILER_API_KEY: str = ""
    NEXT_PUBLIC_MAPTILER_API_KEY: str = ""

    # Weather
    WEATHER_PROVIDER: str = "open-meteo"  # open-meteo | openweather
    OPENWEATHER_API_KEY: str = ""

    # AI Assistant
    LLM_PROVIDER: str = "local"  # local | openai | anthropic | gemini
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    LLM_MODEL: str = "gpt-4o-mini"

    # OCR
    OCR_PROVIDER: str = "local"  # local | vision_api

    # Defaults for economics (INR)
    DEFAULT_PETROL_PRICE_INR: float = 105.50
    DEFAULT_DIESEL_PRICE_INR: float = 92.50
    DEFAULT_EV_KWH_PRICE_INR: float = 12.00
    DEFAULT_DRIVER_HOURLY_WAGE_INR: float = 150.00
    DEFAULT_MAINTENANCE_PER_KM_INR: float = 2.50


settings = Settings()
