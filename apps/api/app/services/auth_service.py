from datetime import datetime, timedelta, timezone
from hashlib import sha256
import secrets
import time

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from pymongo.errors import DuplicateKeyError

from apps.api.app.core.config import settings
from apps.api.app.core.security import access_expiry, create_access_token, decode_access_token, hash_password, new_id, verify_password
from apps.api.app.db.mongodb import get_mongodb
from apps.api.app.schemas.auth import LoginRequest, RegisterRequest

bearer = HTTPBearer(auto_error=False)
_attempts: dict[str, list[float]] = {}


def _check_rate_limit(key: str) -> None:
    now = time.monotonic()
    window = settings.AUTH_RATE_LIMIT_WINDOW_SECONDS
    if len(_attempts) > 4096:
        _attempts.update({
            item_key: [attempt for attempt in attempts if now - attempt < window]
            for item_key, attempts in list(_attempts.items())
        })
        for item_key in [item_key for item_key, attempts in _attempts.items() if not attempts]:
            _attempts.pop(item_key, None)
    recent = [attempt for attempt in _attempts.get(key, []) if now - attempt < window]
    if len(recent) >= settings.AUTH_RATE_LIMIT_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many attempts. Please try again later.")
    recent.append(now)
    _attempts[key] = recent


def public_user(user: dict) -> dict:
    return {
        "user_id": user["user_id"], "name": user["name"], "email": user["email"],
        "phone": user["phone"], "status": user["status"],
        "email_verified": user["email_verified"], "phone_verified": user["phone_verified"],
        "role": user["role"], "created_at": user["created_at"],
    }


async def _new_session(user: dict, request: Request, device_name: str | None, platform: str | None) -> dict:
    db = get_mongodb()
    expiry = access_expiry()
    session_id = new_id("sess")
    token = create_access_token(user["user_id"], session_id, expiry)
    await db.sessions.insert_one({
        "session_id": session_id,
        "user_id": user["user_id"],
        "created_at": datetime.now(timezone.utc),
        "expires_at": expiry,
        "revoked": False,
        "device_name": device_name,
        "platform": platform,
        "ip_hash": sha256((request.client.host if request.client else "unknown").encode()).hexdigest(),
    })
    return {"access_token": token, "token_type": "bearer", "user": public_user(user)}


async def register(payload: RegisterRequest, request: Request) -> dict:
    _check_rate_limit(f"register:{request.client.host if request.client else 'unknown'}")
    db = get_mongodb()
    now = datetime.now(timezone.utc)
    user = {
        "user_id": new_id("usr"), "name": payload.name, "email": payload.email,
        "phone": payload.phone, "password_hash": hash_password(payload.password),
        "status": "active",
        "role": "user",
        "email_verified": False,
        "phone_verified": False, "created_at": now, "updated_at": now,
        "last_login_at": now,
    }
    try:
        await db.users.insert_one(user)
    except DuplicateKeyError as exc:
        key_pattern = (exc.details or {}).get("keyPattern", {})
        duplicate_field = "email" if "email" in key_pattern or "email" in str(exc).lower() else "phone number"
        detail = f"An account with this {duplicate_field} already exists."
        raise HTTPException(status_code=409, detail=detail) from exc

    subscription = {
        "subscription_id": new_id("sub"), "user_id": user["user_id"],
        "plan": "free", "billing_cycle": None, "status": "active",
        "start_date": now, "expiry_date": None, "auto_renew": False,
        "provider": None, "provider_subscription_id": None,
        "created_at": now, "updated_at": now,
    }
    preferences = {
        "user_id": user["user_id"], "map_style": "standard",
        "navigation_voice": True, "traffic_enabled": True,
        "avoid_tolls": False, "avoid_highways": False,
        "distance_unit": "km", "updated_at": now,
    }
    try:
        await db.subscriptions.insert_one(subscription)
        await db.user_preferences.insert_one(preferences)
        return await _new_session(user, request, payload.device_name, payload.platform)
    except Exception:
        await db.users.delete_one({"user_id": user["user_id"]})
        await db.subscriptions.delete_one({"user_id": user["user_id"]})
        await db.user_preferences.delete_one({"user_id": user["user_id"]})
        raise


async def login(payload: LoginRequest, request: Request) -> dict:
    key = f"login:{request.client.host if request.client else 'unknown'}:{payload.email}"
    _check_rate_limit(key)
    db = get_mongodb()
    user = await db.users.find_one({"email": payload.email})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.get("status") != "active":
        raise HTTPException(status_code=401, detail="Invalid email or password")
    now = datetime.now(timezone.utc)
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"last_login_at": now, "updated_at": now}})
    _attempts.pop(key, None)
    user["last_login_at"] = now
    return await _new_session(user, request, payload.device_name, payload.platform)


async def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Authentication required", headers={"WWW-Authenticate": "Bearer"})
    try:
        claims = decode_access_token(credentials.credentials)
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired access token", headers={"WWW-Authenticate": "Bearer"}) from exc
    db = get_mongodb()
    now = datetime.now(timezone.utc)
    session = await db.sessions.find_one({
        "session_id": claims["sid"], "user_id": claims["sub"],
        "revoked": False, "expires_at": {"$gt": now},
    })
    user = await db.users.find_one({"user_id": claims["sub"], "status": "active"})
    if not session or not user:
        raise HTTPException(status_code=401, detail="Session is invalid or expired", headers={"WWW-Authenticate": "Bearer"})
    return public_user(user)


async def revoke_session(user_id: str, session_id: str) -> None:
    await get_mongodb().sessions.update_one({"session_id": session_id, "user_id": user_id}, {"$set": {"revoked": True}})


async def revoke_all_sessions(user_id: str, except_session_id: str | None = None) -> None:
    query: dict = {"user_id": user_id, "revoked": False}
    if except_session_id:
        query["session_id"] = {"$ne": except_session_id}
    await get_mongodb().sessions.update_many(query, {"$set": {"revoked": True}})


async def make_password_reset(email: str) -> str | None:
    user = await get_mongodb().users.find_one({"email": email})
    if not user:
        return None
    raw_token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    await get_mongodb().password_resets.insert_one({
        "token_hash": sha256(raw_token.encode()).hexdigest(),
        "user_id": user["user_id"], "created_at": now,
        "expires_at": now + timedelta(minutes=20), "used": False,
    })
    return raw_token


async def consume_password_reset(raw_token: str, password: str) -> bool:
    db = get_mongodb()
    now = datetime.now(timezone.utc)
    reset = await db.password_resets.find_one_and_delete({
        "token_hash": sha256(raw_token.encode()).hexdigest(), "used": False,
        "expires_at": {"$gt": now},
    })
    if not reset:
        return False
    await db.users.update_one(
        {"user_id": reset["user_id"]},
        {"$set": {"password_hash": hash_password(password), "updated_at": now}},
    )
    await revoke_all_sessions(reset["user_id"])
    return True
