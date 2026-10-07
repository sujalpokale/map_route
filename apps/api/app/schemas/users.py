import re
from pydantic import BaseModel, EmailStr, Field, field_validator


class ProfilePatch(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, min_length=8, max_length=20)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = " ".join(value.split())
        if len(value) < 2 or not re.fullmatch(r"[\w .'-]+", value, re.UNICODE):
            raise ValueError("Enter a valid name")
        return value

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str | None) -> str | None:
        return value.strip().lower() if value else value


class PreferencesPatch(BaseModel):
    map_style: str | None = Field(default=None, pattern="^(standard|satellite|terrain)$")
    navigation_voice: bool | None = None
    traffic_enabled: bool | None = None
    avoid_tolls: bool | None = None
    avoid_highways: bool | None = None
    distance_unit: str | None = Field(default=None, pattern="^(km|mi)$")
    vehicle_settings: dict[str, "VehicleEconomics"] | None = None


class VehicleEconomics(BaseModel):
    efficiency_kmpl: float = Field(gt=0, le=500)
    fuel_price_inr: float = Field(gt=0, le=10000)
