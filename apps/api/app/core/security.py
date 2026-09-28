import datetime
from typing import Any, Optional, Union
import hashlib
import secrets

try:
    from jose import jwt
    JOSE_AVAILABLE = True
except ImportError:
    JOSE_AVAILABLE = False

try:
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
except ImportError:
    pwd_context = None

from apps.api.app.core.config import settings


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if pwd_context:
        try:
            return pwd_context.verify(plain_password, hashed_password)
        except Exception:
            pass
    # Fallback sha256 + salt for minimal dependencies environment
    if ":" in hashed_password:
        salt, h = hashed_password.split(":", 1)
        test_h = hashlib.sha256((plain_password + salt).encode("utf-8")).hexdigest()
        return test_h == h
    return False


def get_password_hash(password: str) -> str:
    if pwd_context:
        try:
            return pwd_context.hash(password)
        except Exception:
            pass
    salt = secrets.token_hex(8)
    h = hashlib.sha256((password + salt).encode("utf-8")).hexdigest()
    return f"{salt}:{h}"


def create_access_token(subject: Union[str, Any], expires_delta: Optional[datetime.timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.datetime.now(datetime.timezone.utc) + expires_delta
    else:
        expire = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    to_encode = {"exp": expire, "sub": str(subject)}
    if JOSE_AVAILABLE:
        return jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")
    else:
        # Fallback signed payload
        payload = f"{to_encode['sub']}|{int(expire.timestamp())}"
        signature = hashlib.sha256((payload + settings.SECRET_KEY).encode()).hexdigest()
        return f"{payload}|{signature}"


def decode_access_token(token: str) -> Optional[str]:
    if JOSE_AVAILABLE:
        try:
            decoded = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            return decoded.get("sub")
        except Exception:
            return None
    else:
        parts = token.split("|")
        if len(parts) == 3:
            sub, exp_str, sig = parts
            check_sig = hashlib.sha256((f"{sub}|{exp_str}" + settings.SECRET_KEY).encode()).hexdigest()
            if check_sig == sig and int(exp_str) > datetime.datetime.now(datetime.timezone.utc).timestamp():
                return sub
        return None
