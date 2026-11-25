"""Admin bejelentkezés és kijelentkezés végpontjai."""

from __future__ import annotations

import logging
import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from .. import config, security
from ..schemas import AdminLoginInput

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger(__name__)


@router.post("/login")
def admin_login(payload: AdminLoginInput, request: Request, response: Response) -> dict[str, Any]:
    now = time.time()
    client_id = security.client_identifier(request)
    retry_after = security.login_retry_after(client_id, now)
    if retry_after is not None:
        logger.warning("Admin login rate limit reached for client %s", client_id)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )

    if not security.password_matches(payload.password):
        security.record_failed_login(client_id, now)
        logger.warning("Failed admin login for client %s", client_id)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin credentials.")

    security.FAILED_LOGIN_ATTEMPTS.pop(client_id, None)
    token = security.issue_token(now)
    response.headers["Cache-Control"] = "no-store"
    return {"token": token, "expires_in": config.ADMIN_TOKEN_TTL_SECONDS}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def admin_logout(admin_token: str = Depends(security.require_admin)) -> Response:
    security.ACTIVE_ADMIN_TOKENS.pop(admin_token, None)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
