import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from apps.api.app.db.mongodb import get_mongodb
from apps.api.app.schemas.users import PreferencesPatch, ProfilePatch
from apps.api.app.services.auth_service import get_current_user

router = APIRouter()


@router.get("/me")
async def current_profile(user=Depends(get_current_user)):
    db = get_mongodb()
    subscription = await db.subscriptions.find_one(
        {"user_id": user["user_id"]}, sort=[("created_at", -1)]
    )
    return {**user, "subscription": {
        "plan": subscription["plan"], "status": subscription["status"],
    } if subscription else {"plan": "free", "status": "inactive"}}


@router.patch("/me")
async def update_profile(payload: ProfilePatch, user=Depends(get_current_user)):
    changes = payload.model_dump(exclude_unset=True, exclude_none=True)
    if not changes:
        raise HTTPException(status_code=422, detail="Provide at least one profile field")
    if "name" in changes:
        changes["name"] = " ".join(changes["name"].split())
        if len(changes["name"]) < 2:
            raise HTTPException(status_code=422, detail="Enter a valid name")
    if "phone" in changes:
        phone = re.sub(r"[\s().-]", "", changes["phone"])
        if phone.startswith("00"):
            phone = "+" + phone[2:]
        if not re.fullmatch(r"\+[1-9]\d{7,14}", phone):
            raise HTTPException(status_code=422, detail="Phone must use international format")
        changes["phone"] = phone
    if changes.get("email") == user["email"]:
        changes.pop("email")
    if changes.get("phone") == user["phone"]:
        changes.pop("phone")
    if not changes:
        return user
    if "email" in changes:
        raise HTTPException(status_code=501, detail="Email changes require a verification provider, which is not configured")
    if "phone" in changes:
        raise HTTPException(status_code=501, detail="Phone changes require a verification provider, which is not configured")
    changes["updated_at"] = datetime.now(timezone.utc)
    try:
        updated = await get_mongodb().users.find_one_and_update(
            {"user_id": user["user_id"], "status": "active"},
            {"$set": changes}, return_document=ReturnDocument.AFTER,
        )
    except DuplicateKeyError as exc:
        field = "email" if "email" in str(exc).lower() else "phone number"
        raise HTTPException(status_code=409, detail=f"An account with this {field} already exists.") from exc
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    return {key: updated[key] for key in (
        "user_id", "name", "email", "phone", "status", "email_verified",
        "phone_verified", "role", "created_at",
    )}


@router.get("/me/preferences")
async def get_preferences(user=Depends(get_current_user)):
    defaults = {
        "user_id": user["user_id"], "map_style": "standard",
        "navigation_voice": True, "traffic_enabled": True,
        "avoid_tolls": False, "avoid_highways": False, "distance_unit": "km",
        "vehicle_settings": {},
    }
    stored = await get_mongodb().user_preferences.find_one({"user_id": user["user_id"]})
    if stored:
        stored.pop("_id", None)
    return {**defaults, **(stored or {})}


@router.patch("/me/preferences")
async def update_preferences(payload: PreferencesPatch, user=Depends(get_current_user)):
    changes = payload.model_dump(exclude_unset=True, exclude_none=True)
    if not changes:
        raise HTTPException(status_code=422, detail="Provide at least one preference")
    changes["updated_at"] = datetime.now(timezone.utc)
    prefs = await get_mongodb().user_preferences.find_one_and_update(
        {"user_id": user["user_id"]},
        {"$set": changes, "$setOnInsert": {"user_id": user["user_id"]}},
        upsert=True, return_document=ReturnDocument.AFTER,
    )
    return {key: prefs.get(key) for key in (
        "user_id", "map_style", "navigation_voice", "traffic_enabled",
        "avoid_tolls", "avoid_highways", "distance_unit", "vehicle_settings", "updated_at",
    )}
