import math
from typing import Dict, Any, Tuple
from apps.api.app.schemas import VehicleTypeEnum, FuelTypeEnum
from apps.api.app.core.config import settings


class VehiclePhysicsProfile:
    def __init__(
        self,
        vehicle_type: VehicleTypeEnum,
        fuel_type: FuelTypeEnum,
        curb_weight_kg: float,
        drag_coeff: float,
        frontal_area_m2: float,
        baseline_kmpl: float,
        engine_efficiency: float,
        battery_capacity_kwh: float = 0.0
    ):
        self.vehicle_type = vehicle_type
        self.fuel_type = fuel_type
        self.curb_weight_kg = curb_weight_kg
        self.drag_coeff = drag_coeff
        self.frontal_area_m2 = frontal_area_m2
        self.baseline_kmpl = baseline_kmpl
        self.engine_efficiency = engine_efficiency
        self.battery_capacity_kwh = battery_capacity_kwh


DEFAULT_PROFILES: Dict[VehicleTypeEnum, VehiclePhysicsProfile] = {
    VehicleTypeEnum.BIKE: VehiclePhysicsProfile(
        vehicle_type=VehicleTypeEnum.BIKE,
        fuel_type=FuelTypeEnum.PETROL,
        curb_weight_kg=150.0,
        drag_coeff=0.6,
        frontal_area_m2=0.7,
        baseline_kmpl=45.0,
        engine_efficiency=0.25
    ),
    VehicleTypeEnum.CAR: VehiclePhysicsProfile(
        vehicle_type=VehicleTypeEnum.CAR,
        fuel_type=FuelTypeEnum.PETROL,
        curb_weight_kg=1300.0,
        drag_coeff=0.31,
        frontal_area_m2=2.2,
        baseline_kmpl=16.0,
        engine_efficiency=0.30
    ),
    VehicleTypeEnum.VAN: VehiclePhysicsProfile(
        vehicle_type=VehicleTypeEnum.VAN,
        fuel_type=FuelTypeEnum.DIESEL,
        curb_weight_kg=2200.0,
        drag_coeff=0.42,
        frontal_area_m2=3.4,
        baseline_kmpl=12.5,
        engine_efficiency=0.35
    ),
    VehicleTypeEnum.TRUCK: VehiclePhysicsProfile(
        vehicle_type=VehicleTypeEnum.TRUCK,
        fuel_type=FuelTypeEnum.DIESEL,
        curb_weight_kg=8500.0,
        drag_coeff=0.75,
        frontal_area_m2=6.8,
        baseline_kmpl=4.5,
        engine_efficiency=0.40
    ),
    VehicleTypeEnum.BUS: VehiclePhysicsProfile(
        vehicle_type=VehicleTypeEnum.BUS,
        fuel_type=FuelTypeEnum.DIESEL,
        curb_weight_kg=9500.0,
        drag_coeff=0.68,
        frontal_area_m2=6.2,
        baseline_kmpl=4.0,
        engine_efficiency=0.38
    ),
    VehicleTypeEnum.EV: VehiclePhysicsProfile(
        vehicle_type=VehicleTypeEnum.EV,
        fuel_type=FuelTypeEnum.ELECTRIC,
        curb_weight_kg=1800.0,
        drag_coeff=0.25,
        frontal_area_m2=2.3,
        baseline_kmpl=6.5,  # km per kWh
        engine_efficiency=0.88,
        battery_capacity_kwh=65.0
    ),
}


class PhysicsEngine:
    @staticmethod
    def get_fuel_price(fuel_type: FuelTypeEnum) -> float:
        if fuel_type == FuelTypeEnum.DIESEL:
            return settings.DEFAULT_DIESEL_PRICE_INR
        elif fuel_type == FuelTypeEnum.ELECTRIC:
            return settings.DEFAULT_EV_KWH_PRICE_INR
        return settings.DEFAULT_PETROL_PRICE_INR

    @classmethod
    def calculate_consumption(
        cls,
        distance_km: float,
        duration_min: float,
        vehicle_type: VehicleTypeEnum,
        fuel_type: FuelTypeEnum,
        payload_kg: float = 0.0,
        custom_efficiency: float = None,
        traffic_delay_min: float = 0.0,
        elevation_gain_m: float = 0.0
    ) -> Tuple[float, float, float]:
        """
        Calculates fuel/energy consumed, effective efficiency, and total fuel cost.
        Returns (consumed_litres_or_kwh, effective_kmpl, fuel_cost_inr).
        """
        profile = DEFAULT_PROFILES.get(vehicle_type, DEFAULT_PROFILES[VehicleTypeEnum.CAR])
        base_kmpl = custom_efficiency if (custom_efficiency and custom_efficiency > 0) else profile.baseline_kmpl

        # 1. Mass penalty: payload increases rolling resistance and acceleration work
        total_mass = profile.curb_weight_kg + payload_kg
        mass_ratio = total_mass / profile.curb_weight_kg
        payload_factor = 1.0 + (mass_ratio - 1.0) * 0.35

        # 2. Speed and aerodynamic drag factor
        avg_speed_kmh = (distance_km / max(duration_min, 1.0)) * 60.0
        # Optimal cruising speed around 60-70 km/h; drag grows as v^2
        speed_factor = 1.0
        if avg_speed_kmh > 80:
            speed_factor += ((avg_speed_kmh - 80) / 40.0) * 0.25
        elif avg_speed_kmh < 25:
            # Low speed urban penalty (low gear efficiency)
            speed_factor += ((25 - avg_speed_kmh) / 25.0) * 0.20

        # 3. Congestion / Idle Stop-and-Go Penalty
        idle_factor = 1.0
        if traffic_delay_min > 0:
            # Idling consumes ~0.8-1.5 L/hour + kinetic braking loss
            idle_penalty_pct = min((traffic_delay_min / max(duration_min, 1.0)) * 0.50, 0.40)
            idle_factor += idle_penalty_pct

        # 4. Elevation gradient penalty
        elevation_factor = 1.0 + (elevation_gain_m / 1000.0) * 0.08

        # Effective consumption
        effective_kmpl = base_kmpl / (payload_factor * speed_factor * idle_factor * elevation_factor)
        effective_kmpl = max(effective_kmpl, 1.0)

        consumed_litres_or_kwh = round(distance_km / effective_kmpl, 2)
        fuel_price = cls.get_fuel_price(fuel_type)
        fuel_cost_inr = round(consumed_litres_or_kwh * fuel_price, 2)

        return consumed_litres_or_kwh, round(effective_kmpl, 2), fuel_cost_inr

    @classmethod
    def calculate_total_route_cost(
        cls,
        fuel_cost_inr: float,
        toll_cost_inr: float,
        duration_min: float,
        distance_km: float,
        driver_wage_per_hour: float = None,
        maintenance_per_km: float = None
    ) -> Dict[str, float]:
        hourly_wage = driver_wage_per_hour or settings.DEFAULT_DRIVER_HOURLY_WAGE_INR
        maint_rate = maintenance_per_km or settings.DEFAULT_MAINTENANCE_PER_KM_INR

        driver_cost = round((duration_min / 60.0) * hourly_wage, 2)
        maint_cost = round(distance_km * maint_rate, 2)
        total_cost = round(fuel_cost_inr + toll_cost_inr + driver_cost + maint_cost, 2)

        return {
            "fuel_cost_inr": fuel_cost_inr,
            "toll_cost_inr": toll_cost_inr,
            "driver_cost_inr": driver_cost,
            "maintenance_cost_inr": maint_cost,
            "total_cost_inr": total_cost
        }
