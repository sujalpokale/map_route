from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "apps/api/.env"),
        env_file_encoding="utf-8",
        env_ignore_empty=True,
        extra="ignore",
        case_sensitive=False
    )

    APP_NAME: str = "Route Intelligence Platform"
    APP_ENV: str = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"
    SECRET_KEY: str = "dev_secret_key_change_in_production_super_secret_jwt_key_98234"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    MONGODB_URI: str = ""
    MONGODB_DATABASE: str = "route_intelligence"
    JWT_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    AUTH_RATE_LIMIT_ATTEMPTS: int = 8
    AUTH_RATE_LIMIT_WINDOW_SECONDS: int = 300
    PREMIUM_MONTHLY_PRICE_INR: int | None = 199
    PREMIUM_YEARLY_PRICE_INR: int | None = 1499
    FEATURE_ACCESS_OVERRIDES: str = ""

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:19006",
        "http://127.0.0.1:19006"
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
    ROUTING_PROVIDER: str = "here"  # here | osrm | mapbox | google | simulation
    OSRM_BASE_URL: str = "https://router.project-osrm.org"
    NOMINATIM_BASE_URL: str = "https://nominatim.openstreetmap.org"
    MAPBOX_ACCESS_TOKEN: str = ""
    GOOGLE_MAPS_API_KEY: str = ""
    HERE_API_KEY: str = ""
    HERE_ROUTING_URL: str = "https://router.hereapi.com/v8/routes"
    HERE_TRAFFIC_URL: str = "https://data.traffic.hereapi.com/v7/flow"
    HERE_TRAFFIC_CACHE_TTL_SECONDS: int = 30
    REROUTE_MIN_TIME_SAVING_MINUTES: float = 5.0
    REROUTE_MIN_PERCENT_IMPROVEMENT: float = 10.0
    REROUTE_COOLDOWN_SECONDS: int = 300
    ROUTE_MATRIX_MAX_LOCATIONS: int = 10
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
    AI_PROVIDER: str = "local"  # local | openai
    AI_MODEL: str = "gpt-4o-mini"
    AI_API_KEY: str = ""

    # OCR
    OCR_PROVIDER: str = "ocr_space"  # ocr_space | local | vision_api
    OCR_SPACE_API_KEY: str = ""

    # Navigation thresholds
    NAVIGATION_LOCATION_UPDATE_SECONDS: int = 1
    ROUTE_RECALCULATION_INTERVAL_SECONDS: int = 30
    OFF_ROUTE_DISTANCE_METERS: float = 50.0
    ARRIVAL_RADIUS_METERS: float = 30.0

    # Defaults for economics (INR)
    DEFAULT_PETROL_PRICE_INR: float = 105.50
    DEFAULT_DIESEL_PRICE_INR: float = 92.50
    DEFAULT_EV_KWH_PRICE_INR: float = 12.00
    DEFAULT_DRIVER_HOURLY_WAGE_INR: float = 150.00
    DEFAULT_MAINTENANCE_PER_KM_INR: float = 2.50


settings = Settings()
