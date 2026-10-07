from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from apps.api.app.core.security import hash_password, new_id, verify_password
from apps.api.app.schemas.auth import RegisterRequest
from apps.api.app.services import auth_service, feature_access


class FakeCollection:
    def __init__(self, docs=None):
        self.docs = list(docs or [])

    async def insert_one(self, document):
        for key in ("email", "phone", "user_id", "session_id", "subscription_id"):
            if document.get(key) is not None and any(item.get(key) == document[key] for item in self.docs):
                from pymongo.errors import DuplicateKeyError
                raise DuplicateKeyError(f"{key}_1 duplicate")
        self.docs.append(dict(document))
        return type("Result", (), {"inserted_id": "id"})()

    async def find_one(self, query, sort=None):
        def matches(doc):
            for key, expected in query.items():
                actual = doc.get(key)
                if isinstance(expected, dict) and "$gt" in expected:
                    if actual is None or actual <= expected["$gt"]:
                        return False
                elif actual != expected:
                    return False
            return True
        return next((doc for doc in self.docs if matches(doc)), None)

    async def update_one(self, query, update):
        doc = await self.find_one(query)
        if doc:
            doc.update(update.get("$set", {}))

    async def update_many(self, query, update):
        for doc in self.docs:
            if all(doc.get(k) == v for k, v in query.items()):
                doc.update(update.get("$set", {}))

    async def delete_one(self, query):
        self.docs[:] = [doc for doc in self.docs if not all(doc.get(k) == v for k, v in query.items())]

    async def find_one_and_delete(self, query):
        doc = await self.find_one(query)
        if doc:
            await self.delete_one({"token_hash": doc["token_hash"]})
        return doc


class FakeDatabase:
    def __init__(self, users=None, subscriptions=None):
        self.users = FakeCollection(users)
        self.sessions = FakeCollection()
        self.subscriptions = FakeCollection(subscriptions)
        self.user_preferences = FakeCollection()
        self.password_resets = FakeCollection()


def request(ip="127.0.0.1"):
    return Request({"type": "http", "method": "POST", "path": "/", "headers": [], "client": (ip, 1234), "server": ("test", 80), "scheme": "http"})


def test_password_hashing_and_verification():
    hashed = hash_password("CorrectHorse9Battery")
    assert hashed != "CorrectHorse9Battery"
    assert verify_password("CorrectHorse9Battery", hashed)
    assert not verify_password("wrong", hashed)


def test_user_id_is_random_and_stable_shape():
    first, second = new_id("usr"), new_id("usr")
    assert first.startswith("usr_") and len(first) >= 20
    assert first != second


def test_registration_validation_and_normalization():
    body = RegisterRequest(name="  Sujal   Pokale ", email="USER@Example.com", phone="+91 98765-43210", password="StrongPassword9")
    assert body.name == "Sujal Pokale"
    assert body.email == "user@example.com"
    assert body.phone == "+919876543210"
    with pytest.raises(ValueError):
        RegisterRequest(name="X", email="not-an-email", phone="123", password="weak")


def test_vehicle_economics_preference_bounds():
    from apps.api.app.schemas.users import PreferencesPatch

    settings = PreferencesPatch(vehicle_settings={
        "veh_car_02": {"efficiency_kmpl": 17.5, "fuel_price_inr": 109.25},
    })
    assert settings.vehicle_settings["veh_car_02"].efficiency_kmpl == 17.5
    with pytest.raises(ValueError):
        PreferencesPatch(vehicle_settings={"veh_car_02": {"efficiency_kmpl": 0, "fuel_price_inr": 109}})


@pytest.mark.asyncio
async def test_register_persists_user_free_plan_preferences_and_session(monkeypatch):
    db = FakeDatabase()
    monkeypatch.setattr(auth_service, "get_mongodb", lambda: db)
    monkeypatch.setattr(auth_service, "create_access_token", lambda *_: "signed-token")
    auth_service._attempts.clear()
    payload = RegisterRequest(name="Sujal Pokale", email="sujal@example.com", phone="+919876543210", password="StrongPassword9")

    result = await auth_service.register(payload, request())

    assert result["access_token"] == "signed-token"
    assert result["user"]["user_id"].startswith("usr_")
    assert "password_hash" not in result["user"]
    stored_user = db.users.docs[0]
    assert verify_password(payload.password, stored_user["password_hash"])
    assert db.subscriptions.docs[0]["plan"] == "free"
    assert db.subscriptions.docs[0]["user_id"] == stored_user["user_id"]
    assert db.user_preferences.docs[0]["user_id"] == stored_user["user_id"]
    assert db.sessions.docs[0]["revoked"] is False


@pytest.mark.asyncio
async def test_duplicate_email_is_rejected(monkeypatch):
    db = FakeDatabase(users=[{"email": "sujal@example.com"}])
    monkeypatch.setattr(auth_service, "get_mongodb", lambda: db)
    auth_service._attempts.clear()
    payload = RegisterRequest(name="Sujal Pokale", email="sujal@example.com", phone="+919876543210", password="StrongPassword9")
    with pytest.raises(HTTPException) as error:
        await auth_service.register(payload, request("127.0.0.2"))
    assert error.value.status_code == 409


@pytest.mark.asyncio
async def test_login_checks_password_and_creates_database_session(monkeypatch):
    password = "StrongPassword9"
    stored_user = {
        "user_id": "usr_persist", "name": "Sujal Pokale", "email": "sujal@example.com",
        "phone": "+919876543210", "password_hash": hash_password(password),
        "status": "active", "role": "user", "email_verified": False,
        "phone_verified": False, "created_at": datetime.now(timezone.utc),
    }
    db = FakeDatabase(users=[stored_user])
    monkeypatch.setattr(auth_service, "get_mongodb", lambda: db)
    monkeypatch.setattr(auth_service, "create_access_token", lambda *_: "signed-token")
    auth_service._attempts.clear()
    from apps.api.app.schemas.auth import LoginRequest

    with pytest.raises(HTTPException) as denied:
        await auth_service.login(LoginRequest(email="sujal@example.com", password="bad"), request("127.0.0.4"))
    assert denied.value.status_code == 401
    result = await auth_service.login(LoginRequest(email="sujal@example.com", password=password), request("127.0.0.4"))
    assert result["user"]["user_id"] == "usr_persist"
    assert db.sessions.docs[0]["user_id"] == "usr_persist"


@pytest.mark.asyncio
async def test_current_user_requires_an_unrevoked_database_session(monkeypatch):
    now = datetime.now(timezone.utc)
    db = FakeDatabase(users=[{
        "user_id": "usr_live", "name": "Sujal", "email": "s@example.com", "phone": "+919876543210",
        "status": "active", "role": "user", "created_at": now,
        "email_verified": False, "phone_verified": False,
    }])
    db.sessions.docs.append({"session_id": "sess_live", "user_id": "usr_live", "revoked": False, "expires_at": now + timedelta(minutes=5)})
    monkeypatch.setattr(auth_service, "get_mongodb", lambda: db)
    monkeypatch.setattr(auth_service, "decode_access_token", lambda _token: {"sub": "usr_live", "sid": "sess_live"})
    from fastapi.security import HTTPAuthorizationCredentials

    result = await auth_service.get_current_user(HTTPAuthorizationCredentials(scheme="Bearer", credentials="test"))
    assert result["user_id"] == "usr_live"
    db.sessions.docs[0]["revoked"] = True
    with pytest.raises(HTTPException) as denied:
        await auth_service.get_current_user(HTTPAuthorizationCredentials(scheme="Bearer", credentials="test"))
    assert denied.value.status_code == 401


@pytest.mark.asyncio
async def test_premium_feature_denies_free_and_expired_subscriptions(monkeypatch):
    db = FakeDatabase(subscriptions=[{
        "user_id": "usr_x", "plan": "free", "status": "active", "expiry_date": None,
    }])
    monkeypatch.setattr(feature_access, "get_mongodb", lambda: db)
    assert not await feature_access.has_feature("usr_x", "ai_route_assistant")
    db.subscriptions.docs[0].update({"plan": "premium", "expiry_date": datetime.now(timezone.utc) - timedelta(seconds=1)})
    assert not await feature_access.has_feature("usr_x", "ai_route_assistant")
    db.subscriptions.docs[0].update({"expiry_date": None})
    assert await feature_access.has_feature("usr_x", "ai_route_assistant")


def test_profile_schema_does_not_accept_role_or_plan_changes():
    from apps.api.app.schemas.users import ProfilePatch
    payload = ProfilePatch.model_validate({"role": "admin", "plan": "premium", "status": "active"})
    assert payload.model_dump(exclude_unset=True, exclude_none=True) == {}


@pytest.mark.asyncio
async def test_password_reset_tokens_are_hashed_single_use_and_revoke_sessions(monkeypatch):
    db = FakeDatabase(users=[{
        "user_id": "usr_reset", "email": "reset@example.com", "password_hash": hash_password("OldPassword9"),
    }])
    db.sessions.docs.append({"user_id": "usr_reset", "session_id": "sess_old", "revoked": False})
    monkeypatch.setattr(auth_service, "get_mongodb", lambda: db)
    raw_token = await auth_service.make_password_reset("reset@example.com")
    assert raw_token
    assert db.password_resets.docs[0]["token_hash"] != raw_token
    assert await auth_service.consume_password_reset(raw_token, "NewPassword9")
    assert verify_password("NewPassword9", db.users.docs[0]["password_hash"])
    assert db.sessions.docs[0]["revoked"] is True
    assert not await auth_service.consume_password_reset(raw_token, "OtherPassword9")


@pytest.mark.asyncio
async def test_preferences_are_isolated_to_the_authenticated_user(monkeypatch):
    from apps.api.app.api.v1.endpoints import users as user_api

    db = FakeDatabase()
    db.user_preferences.docs.extend([
        {"_id": "mongo-a", "user_id": "usr_a", "distance_unit": "mi"},
        {"_id": "mongo-b", "user_id": "usr_b", "distance_unit": "km"},
    ])
    monkeypatch.setattr(user_api, "get_mongodb", lambda: db)
    result = await user_api.get_preferences({"user_id": "usr_a"})
    assert result["user_id"] == "usr_a"
    assert result["distance_unit"] == "mi"
    assert result["vehicle_settings"] == {}
    assert "_id" not in result


def test_subscription_month_arithmetic_handles_calendar_boundaries():
    from apps.api.app.api.v1.endpoints.subscriptions import _add_months

    start = datetime(2026, 1, 31, tzinfo=timezone.utc)
    assert _add_months(start, 1) == datetime(2026, 2, 28, tzinfo=timezone.utc)
    assert _add_months(start, 12) == datetime(2027, 1, 31, tzinfo=timezone.utc)
