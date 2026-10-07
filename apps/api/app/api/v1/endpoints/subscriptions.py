from calendar import monthrange
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from apps.api.app.core.config import settings
from apps.api.app.db.mongodb import get_mongodb
from apps.api.app.services.auth_service import get_current_user
from apps.api.app.services.feature_access import FEATURES, has_feature, require_admin

router = APIRouter()


class TestPremiumRequest(BaseModel):
    billing_cycle: Literal["monthly", "yearly"]


def _add_months(value: datetime, months: int) -> datetime:
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    day = min(value.day, monthrange(year, month)[1])
    return value.replace(year=year, month=month, day=day)


@router.get("/plans")
async def plans():
    return {
        "currency": "INR",
        "plans": [
            {"plan": "free", "billing_cycle": None, "price": 0},
            {"plan": "premium", "billing_cycle": "monthly", "price": settings.PREMIUM_MONTHLY_PRICE_INR},
            {"plan": "premium", "billing_cycle": "yearly", "price": settings.PREMIUM_YEARLY_PRICE_INR},
        ],
        "features": {name: sorted(plans) for name, plans in FEATURES.items()},
        "payment_provider": "not_configured",
    }


@router.get("/me")
async def my_subscription(user=Depends(get_current_user)):
    db = get_mongodb()
    subscription = await db.subscriptions.find_one(
        {"user_id": user["user_id"]}, sort=[("created_at", -1)]
    )
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    now = datetime.now(timezone.utc)
    expiry = subscription.get("expiry_date")
    expired = expiry is not None and expiry <= now
    if expired and subscription["status"] == "active":
        await db.subscriptions.update_one(
            {"subscription_id": subscription["subscription_id"]},
            {"$set": {"status": "expired", "updated_at": now}},
        )
        subscription["status"] = "expired"
    days_remaining = max(0, (expiry - now).days) if expiry else None
    return {key: subscription.get(key) for key in (
        "subscription_id", "plan", "billing_cycle", "status", "start_date", "expiry_date",
    )} | {"days_remaining": days_remaining}


@router.get("/premium/check/{feature}")
async def check_feature(feature: str, user=Depends(get_current_user)):
    if feature not in FEATURES:
        raise HTTPException(status_code=404, detail="Feature not found")
    return {"feature": feature, "enabled": await has_feature(user["user_id"], feature)}


@router.post("/admin/users/{user_id}/test-premium", status_code=201)
async def create_test_premium(
    user_id: str,
    payload: TestPremiumRequest,
    _admin=Depends(require_admin),
):
    if settings.APP_ENV.lower() != "development":
        raise HTTPException(status_code=404, detail="Not found")
    db = get_mongodb()
    if not await db.users.find_one({"user_id": user_id, "status": "active"}):
        raise HTTPException(status_code=404, detail="User not found")
    now = datetime.now(timezone.utc)
    expiry = _add_months(now, 1 if payload.billing_cycle == "monthly" else 12)
    subscription = {
        "subscription_id": f"sub_test_{user_id}_{int(now.timestamp())}",
        "user_id": user_id, "plan": "premium", "billing_cycle": payload.billing_cycle,
        "status": "active", "start_date": now, "expiry_date": expiry,
        "auto_renew": False, "provider": "development_test", "provider_subscription_id": None,
        "created_at": now, "updated_at": now,
    }
    await db.subscriptions.insert_one(subscription)
    return {key: value for key, value in subscription.items() if key != "_id"}
