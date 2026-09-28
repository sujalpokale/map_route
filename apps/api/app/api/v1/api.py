from fastapi import APIRouter

from apps.api.app.api.v1.endpoints import (
    routes, predict, ai, ocr, fleet, analytics, geocoding
)

api_router = APIRouter()

api_router.include_router(routes.router, prefix="/routes", tags=["Routes & Intelligence"])
api_router.include_router(geocoding.router, prefix="/geocode", tags=["Geocoding & Places"])
api_router.include_router(predict.router, prefix="/predict", tags=["ML Predictions"])
api_router.include_router(ai.router, prefix="/ai", tags=["AI Transportation Assistant"])
api_router.include_router(ocr.router, prefix="/ocr", tags=["OCR & Computer Vision"])
api_router.include_router(fleet.router, prefix="/fleet", tags=["Fleet Telematics"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["Commercial Analytics"])
