from fastapi import HTTPException
from pymongo import ASCENDING, AsyncMongoClient
from pymongo.errors import PyMongoError

from apps.api.app.core.config import settings

_client: AsyncMongoClient | None = None


async def connect_mongodb() -> None:
    global _client
    if not settings.MONGODB_URI:
        return
    _client = AsyncMongoClient(settings.MONGODB_URI, serverSelectionTimeoutMS=5000)
    try:
        await _client.admin.command("ping")
        db = _client[settings.MONGODB_DATABASE]
        await db.users.create_index([("user_id", ASCENDING)], unique=True)
        await db.users.create_index([("email", ASCENDING)], unique=True)
        await db.users.create_index([("phone", ASCENDING)], unique=True)
        await db.sessions.create_index([("session_id", ASCENDING)], unique=True)
        await db.sessions.create_index([("user_id", ASCENDING)])
        await db.sessions.create_index([("expires_at", ASCENDING)], expireAfterSeconds=0)
        await db.subscriptions.create_index([("subscription_id", ASCENDING)], unique=True)
        await db.subscriptions.create_index([("user_id", ASCENDING)])
        await db.user_preferences.create_index([("user_id", ASCENDING)], unique=True)
        await db.password_resets.create_index([("expires_at", ASCENDING)], expireAfterSeconds=0)
    except Exception:
        await close_mongodb()
        raise


async def close_mongodb() -> None:
    global _client
    if _client is not None:
        await _client.close()
        _client = None


def get_mongodb():
    if _client is None:
        raise HTTPException(status_code=503, detail="Account service is not configured")
    return _client[settings.MONGODB_DATABASE]


async def ping_mongodb() -> bool:
    if _client is None:
        return False
    try:
        await _client.admin.command("ping")
        return True
    except PyMongoError:
        return False
