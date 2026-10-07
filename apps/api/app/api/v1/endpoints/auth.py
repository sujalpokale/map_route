from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials

from apps.api.app.core.security import decode_access_token
from apps.api.app.schemas.auth import ForgotPasswordRequest, LoginRequest, RegisterRequest, ResetPasswordRequest
from apps.api.app.services.auth_service import (
    _check_rate_limit, bearer, consume_password_reset, get_current_user, login,
    register, revoke_all_sessions, revoke_session,
)

router = APIRouter()


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_user(payload: RegisterRequest, request: Request):
    return await register(payload, request)


@router.post("/login")
async def login_user(payload: LoginRequest, request: Request):
    return await login(payload, request)


@router.post("/logout")
async def logout_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    user=Depends(get_current_user),
):
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        claims = decode_access_token(credentials.credentials)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid access token") from exc
    await revoke_session(user["user_id"], claims["sid"])
    return {"success": True}


@router.post("/logout-all")
async def logout_all(user=Depends(get_current_user)):
    await revoke_all_sessions(user["user_id"])
    return {"success": True}


@router.post("/forgot-password", status_code=202)
async def forgot_password(payload: ForgotPasswordRequest, request: Request):
    # Token issuance/storage is ready, but delivery is intentionally disabled until an email provider is configured.
    _check_rate_limit(f"forgot:{request.client.host if request.client else 'unknown'}")
    return {"success": True, "message": "If the account exists, reset instructions can be sent after an email provider is configured."}


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest, request: Request):
    _check_rate_limit(f"reset:{request.client.host if request.client else 'unknown'}")
    if not await consume_password_reset(payload.token, payload.new_password):
        raise HTTPException(status_code=400, detail="Reset token is invalid or expired")
    return {"success": True}
