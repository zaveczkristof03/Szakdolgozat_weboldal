"""Admin bejelentkezés és jogosultság.

Hogyan működik?
1. A felhasználó beírja a jelszót → ``POST /admin/login``.
2. Ha helyes, a szerver ad egy véletlen tokent, ami 8 óráig érvényes.
3. Minden írási kérés (új rekord, szerkesztés, törlés) ``X-Admin-Token``
   fejlécben küldi ezt a tokent; a ``require_admin`` ellenőrzi.
4. 5 sikertelen próbálkozás után 15 percig nem lehet újra próbálni.

A tokenek a memóriában vannak: a backend újraindításakor újra be kell lépni.
Egy helyi, egyfelhasználós alkalmazáshoz ez elég és egyszerűen elmagyarázható.
"""

from __future__ import annotations

import logging
import secrets
import time

from fastapi import Header, HTTPException, Request, status

from . import config

logger = logging.getLogger(__name__)

ADMIN_PASSWORD = config.configured_admin_password()
ACTIVE_ADMIN_TOKENS: dict[str, float] = {}
# kliens -> (hibák száma, ablak kezdete, tiltás vége)
FAILED_LOGIN_ATTEMPTS: dict[str, tuple[int, float, float]] = {}
LOGIN_MAX_FAILURES = config.LOGIN_MAX_FAILURES


def purge_expired_admin_tokens(now: float) -> None:
    for token in [token for token, expires_at in ACTIVE_ADMIN_TOKENS.items() if expires_at <= now]:
        ACTIVE_ADMIN_TOKENS.pop(token, None)


def client_identifier(request: Request) -> str:
    return request.client.host if request.client else "unknown-client"


def login_retry_after(client_id: str, now: float) -> int | None:
    state = FAILED_LOGIN_ATTEMPTS.get(client_id)
    if state is None:
        return None
    _failures, window_started, locked_until = state
    if locked_until > now:
        return max(1, int(locked_until - now))
    if now - window_started >= config.LOGIN_FAILURE_WINDOW_SECONDS:
        FAILED_LOGIN_ATTEMPTS.pop(client_id, None)
    return None


def record_failed_login(client_id: str, now: float) -> None:
    failures, window_started, locked_until = FAILED_LOGIN_ATTEMPTS.get(client_id, (0, now, 0.0))
    if now - window_started >= config.LOGIN_FAILURE_WINDOW_SECONDS:
        failures, window_started, locked_until = 0, now, 0.0
    failures += 1
    if failures >= LOGIN_MAX_FAILURES:
        locked_until = now + config.LOGIN_LOCKOUT_SECONDS
    FAILED_LOGIN_ATTEMPTS[client_id] = (failures, window_started, locked_until)


def password_matches(candidate: str) -> bool:
    return secrets.compare_digest(candidate, ADMIN_PASSWORD)


def issue_token(now: float) -> str:
    purge_expired_admin_tokens(now)
    token = secrets.token_urlsafe(32)
    ACTIVE_ADMIN_TOKENS[token] = now + config.ADMIN_TOKEN_TTL_SECONDS
    return token


def require_admin(admin_token: str | None = Header(default=None, alias="X-Admin-Token")) -> str:
    """FastAPI-függőség: csak érvényes, le nem járt tokennel enged tovább."""
    purge_expired_admin_tokens(time.time())
    if not admin_token or admin_token not in ACTIVE_ADMIN_TOKENS:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin login is required for catalog changes.",
        )
    return admin_token
