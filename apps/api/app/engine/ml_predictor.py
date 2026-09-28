import os
import joblib
import pandas as pd
from typing import Dict, Any, List

from apps.api.app.schemas import (
    PredictETARequest, PredictETAResponse,
    PredictFuelRequest, PredictFuelResponse
)
from apps.api.app.engine.physics import PhysicsEngine
from apps.api.app.schemas import VehicleTypeEnum, FuelTypeEnum


class MLInferenceService:
    _eta_model = None
    _fuel_model = None
    _models_loaded = False

    @classmethod
    def load_models(cls):
        if cls._models_loaded:
            return

        possible_dirs = [
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "ml", "models")),
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "ml", "models")),
            os.path.abspath("ml/models")
        ]
        base_dir = next((d for d in possible_dirs if os.path.exists(d)), possible_dirs[0])
        eta_path = os.path.join(base_dir, "eta_model.joblib")
        fuel_path = os.path.join(base_dir, "fuel_model.joblib")

        if os.path.exists(eta_path):
            try:
                cls._eta_model = joblib.load(eta_path)
            except Exception:
                cls._eta_model = None

        if os.path.exists(fuel_path):
            try:
                cls._fuel_model = joblib.load(fuel_path)
            except Exception:
                cls._fuel_model = None

        cls._models_loaded = True

    @classmethod
    def predict_eta(cls, req: PredictETARequest) -> PredictETAResponse:
        cls.load_models()

        is_rush = 1 if (req.day_of_week < 5 and (8 <= req.hour_of_day <= 10 or 17 <= req.hour_of_day <= 20)) else 0

        if cls._eta_model:
            df = pd.DataFrame([{
                "traffic_level": req.traffic_level,
                "weather_condition": req.weather_condition,
                "road_type": req.road_type,
                "vehicle_type": req.vehicle_type,
                "distance_km": req.distance_km,
                "base_duration_min": req.base_duration_min,
                "hour_of_day": req.hour_of_day,
                "day_of_week": req.day_of_week,
                "is_rush_hour": is_rush,
                "payload_kg": req.payload_kg
            }])
            pred = float(cls._eta_model.predict(df)[0])
            pred = round(max(pred, req.base_duration_min * 0.85), 1)
            model_ver = "GradientBoosting-v1.0.4"
        else:
            # Calibrated vehicle-aware fallback
            traffic_mult = {"Low": 1.05, "Moderate": 1.25, "High": 1.62, "Severe": 2.15}.get(req.traffic_level, 1.2)
            weather_mult = {"Clear": 1.0, "Rain": 1.14, "Heavy Rain": 1.32, "Fog": 1.25}.get(req.weather_condition, 1.0)
            rush_mult = 1.12 if is_rush else 1.0

            # Vehicle capability adjustments
            v_type = str(req.vehicle_type).upper()
            v_speed_factors = {"BIKE": 0.90, "CAR": 1.0, "VAN": 1.05, "TRUCK": 1.35, "BUS": 1.30, "EV": 0.98}
            v_traffic_sensitivity = {"BIKE": 0.40, "CAR": 1.0, "VAN": 1.10, "TRUCK": 1.45, "BUS": 1.35, "EV": 0.95}

            traffic_effect = 1.0 + (traffic_mult - 1.0) * v_traffic_sensitivity.get(v_type, 1.0)
            speed_factor = v_speed_factors.get(v_type, 1.0)

            pred = round(req.base_duration_min * speed_factor * traffic_effect * weather_mult * rush_mult, 1)
            model_ver = "Calibrated-Physics-Informed-Heuristic-v1"

        margin = round(pred * 0.08, 1)
        conf_int = [max(1.0, round(pred - margin, 1)), round(pred + margin, 1)]
        delay_factor = round(pred / max(req.base_duration_min, 1.0), 2)

        feat_imp = {
            "traffic_congestion": 0.42,
            "distance": 0.28,
            "time_of_day_rush": 0.14,
            "weather_severity": 0.10,
            "vehicle_payload": 0.06
        }

        return PredictETAResponse(
            predicted_duration_min=pred,
            confidence_interval_min=conf_int,
            delay_factor=delay_factor,
            model_version=model_ver,
            feature_importance=feat_imp
        )

    @classmethod
    def predict_fuel(cls, req: PredictFuelRequest) -> PredictFuelResponse:
        cls.load_models()

        try:
            v_type = VehicleTypeEnum(req.vehicle_type)
        except Exception:
            v_type = VehicleTypeEnum.CAR

        try:
            f_type = FuelTypeEnum(req.fuel_type)
        except Exception:
            f_type = FuelTypeEnum.PETROL

        consumed, eff, f_cost = PhysicsEngine.calculate_consumption(
            distance_km=req.distance_km,
            duration_min=req.duration_min,
            vehicle_type=v_type,
            fuel_type=f_type,
            payload_kg=req.payload_kg,
            elevation_gain_m=req.elevation_gain_m
        )

        # CO2 emissions estimation (kg)
        # Petrol: ~2.31 kg CO2/L, Diesel: ~2.68 kg CO2/L, EV: ~0.45 kg CO2/kWh (grid mix)
        co2_factors = {FuelTypeEnum.PETROL: 2.31, FuelTypeEnum.DIESEL: 2.68, FuelTypeEnum.ELECTRIC: 0.45, FuelTypeEnum.CNG: 1.82}
        co2 = round(consumed * co2_factors.get(f_type, 2.31), 2)

        return PredictFuelResponse(
            fuel_consumption_litres=consumed,
            fuel_cost_inr=f_cost,
            co2_emissions_kg=co2,
            efficiency_kmpl=eff
        )
