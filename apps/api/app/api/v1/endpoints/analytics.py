from fastapi import APIRouter
from typing import Dict, Any

router = APIRouter()


@router.get("/dashboard")
async def get_analytics_dashboard() -> Dict[str, Any]:
    """
    Returns enterprise transportation intelligence KPIs,
    fuel savings, route duration trends, and ML ETA accuracy metrics.
    """
    return {
        "kpis": {
            "total_trips_completed": 1428,
            "total_distance_km": 48320.5,
            "fuel_saved_litres": 3280.4,
            "cost_saved_inr": 344442.0,
            "co2_offset_kg": 7920.0,
            "avg_eta_prediction_error_min": 2.4,
            "fleet_active_count": 18,
            "on_time_delivery_rate": 96.8
        },
        "monthly_fuel_cost_trend": [
            {"month": "Jan", "standard_cost": 182000, "optimized_cost": 154000, "saved": 28000},
            {"month": "Feb", "standard_cost": 194000, "optimized_cost": 162000, "saved": 32000},
            {"month": "Mar", "standard_cost": 210000, "optimized_cost": 175000, "saved": 35000},
            {"month": "Apr", "standard_cost": 205000, "optimized_cost": 168000, "saved": 37000},
            {"month": "May", "standard_cost": 228000, "optimized_cost": 188000, "saved": 40000},
            {"month": "Jun", "standard_cost": 242000, "optimized_cost": 198000, "saved": 44000},
        ],
        "eta_error_distribution": [
            {"error_bucket": "0 - 2 min (Precision)", "percentage": 64},
            {"error_bucket": "2 - 5 min (Acceptable)", "percentage": 26},
            {"error_bucket": "5 - 10 min (Mild Delay)", "percentage": 8},
            {"error_bucket": "> 10 min (Extreme Congestion)", "percentage": 2},
        ],
        "strategy_adoption": [
            {"name": "Fuel Efficient", "value": 38},
            {"name": "Fastest", "value": 27},
            {"name": "Balanced", "value": 21},
            {"name": "Cheapest", "value": 14},
        ]
    }
