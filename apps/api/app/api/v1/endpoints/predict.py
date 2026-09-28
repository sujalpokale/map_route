from fastapi import APIRouter
from apps.api.app.schemas import (
    PredictETARequest, PredictETAResponse,
    PredictFuelRequest, PredictFuelResponse
)
from apps.api.app.engine.ml_predictor import MLInferenceService

router = APIRouter()


@router.post("/eta", response_model=PredictETAResponse)
async def predict_eta(request: PredictETARequest):
    """
    Predicts journey duration using the Machine Learning regressor,
    accounting for congestion, weather, vehicle weight, and temporal factors.
    """
    return MLInferenceService.predict_eta(request)


@router.post("/fuel", response_model=PredictFuelResponse)
async def predict_fuel(request: PredictFuelRequest):
    """
    Predicts fuel/energy consumption, fuel cost, and CO2 emissions
    using physics-augmented ML vehicle dynamics.
    """
    return MLInferenceService.predict_fuel(request)
