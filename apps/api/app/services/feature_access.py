from datetime import datetime, timezone
from typing import Callable

from fastapi import Depends, HTTPException, status

from apps.api.app.db.mongodb import get_mongodb
from apps.api.app.core.config import settings
from apps.api.app.services.auth_service import get_current_user

FEATURES = {
    "basic_navigation": {"free", "premium"},
    "basic_route_calculation": {"free", "premium"},
    "limited_route_planning": {"free", "premium"},
    "ai_route_assistant": {"premium"},
    "advanced_traffic": {"premium"},
    "advanced_navigation": {"premium"},
    "multi_stop_optimization": {"premium"},
    "route_analytics": {"premium"},
}

for override in settings.FEATURE_ACCESS_OVERRIDES.split(";"):
    feature, separator, plans = override.partition("=")
    if separator and feature.strip() in FEATURES:
        configured_plans = {plan.strip().lower() for plan in plans.split(",") if plan.strip()}
        if configured_plans and configured_plans <= {"free", "premium"}:
            FEATURES[feature.strip()] = configured_plans


async def has_feature(user_id: str, feature: str) -> bool:
    if feature not in FEATURES:
        return False
    subscription = await get_mongodb().subscriptions.find_one(
        {"user_id": user_id, "status": "active"}, sort=[("created_at", -1)]
    )
    if not subscription:
        return False
    expiry = subscription.get("expiry_date")
    return (
        subscription.get("plan") in FEATURES[feature]
        and (expiry is None or expiry > datetime.now(timezone.utc))
    )


def require_feature(feature: str) -> Callable:
    async def dependency(user=Depends(get_current_user)):
        if not await has_feature(user["user_id"], feature):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Premium subscription required")
        return user
    return dependency


require_premium = require_feature("ai_route_assistant")
require_limited_route_planning = require_feature("limited_route_planning")


async def require_admin(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrator access required")
    return user
