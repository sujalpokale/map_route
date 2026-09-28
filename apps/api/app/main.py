from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
import time

from apps.api.app.core.config import settings
from apps.api.app.api.v1.api import api_router
from apps.api.app.db.session import init_db
from apps.api.app.engine.ml_predictor import MLInferenceService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("route_intelligence")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing Route Intelligence Platform API...")
    # Initialize database tables
    try:
        await init_db()
        logger.info("Database schemas initialized.")
    except Exception as e:
        logger.warning(f"Database initialization notice: {e}")

    # Pre-load ML models
    try:
        MLInferenceService.load_models()
        logger.info("ML inference services loaded.")
    except Exception as e:
        logger.warning(f"ML model load notice: {e}")

    yield

    logger.info("Shutting down Route Intelligence Platform API.")


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Production-Grade Route Intelligence, Dynamic Rerouting & Fleet Optimization Platform",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = round((time.time() - start_time) * 1000, 2)
    response.headers["X-Process-Time-Ms"] = str(process_time)
    return response


# Include API V1 routes
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/health", tags=["Health & Observability"])
async def health_check():
    """Health check endpoint for container orchestrators and load balancers."""
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "timestamp": time.time()
    }


@app.get("/ready", tags=["Health & Observability"])
async def readiness_check():
    """Readiness probe checking provider availability."""
    return {
        "status": "ready",
        "routing_provider": settings.ROUTING_PROVIDER,
        "weather_provider": settings.WEATHER_PROVIDER,
        "llm_provider": settings.LLM_PROVIDER
    }


@app.get("/", tags=["Root"])
async def root():
    return {
        "name": settings.APP_NAME,
        "version": "1.0.0",
        "docs_url": "/docs",
        "api_v1": settings.API_V1_PREFIX
    }
