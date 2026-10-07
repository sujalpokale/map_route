from datetime import datetime, timedelta, timezone
from secrets import token_urlsafe

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from jose import JWTError, jwt

from apps.api.app.core.config import settings

_password_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _password_hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def new_id(prefix: str) -> str:
    return f"{prefix}_{token_urlsafe(12)}"


def create_access_token(user_id: str, session_id: str, expires_at: datetime) -> str:
    if not settings.JWT_SECRET:
        raise RuntimeError("JWT_SECRET must be configured")
    return jwt.encode(
        {"sub": user_id, "sid": session_id, "type": "access", "exp": expires_at},
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )


def decode_access_token(token: str) -> dict:
    if not settings.JWT_SECRET:
        raise JWTError("JWT signing is not configured")
    claims = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    if claims.get("type") != "access" or not claims.get("sub") or not claims.get("sid"):
        raise JWTError("Invalid token claims")
    return claims


def access_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
