"""Alkalmazásbeállítások.

Mit csinál? Egy helyen tartja azokat az értékeket, amelyek a környezettől függenek.
Miért kell? Így a tesztek egy ideiglenes adatbázist használhatnak, az éles fájl
pedig érintetlen marad.
"""

from __future__ import annotations

import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]

# Az SQLite fájl helye. Az EKG_DB_PATH környezeti változóval felülírható.
DEFAULT_DB_PATH = BACKEND_DIR / "ekg_metadata.db"

# A verziókezelt, ellenőrzött katalógus (minden rekord). Ebből lehet újraépíteni a DB-t.
CATALOG_JSON_PATH = BACKEND_DIR / "data" / "catalog.json"
BACKUP_DIR = BACKEND_DIR / "backups"

ADMIN_TOKEN_TTL_SECONDS = 8 * 60 * 60
LOGIN_MAX_FAILURES = 5
LOGIN_FAILURE_WINDOW_SECONDS = 15 * 60
LOGIN_LOCKOUT_SECONDS = 15 * 60

CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
]


def configured_admin_password() -> str:
    """Return the mandatory admin password without ever logging its value.

    Ha nincs beállítva jelszó, a backend el sem indul: így nem lehet véletlenül
    védelem nélküli írási végpontokat közzétenni.
    """
    password = os.getenv("EKG_ADMIN_PASSWORD")
    if password is None or not password.strip():
        raise RuntimeError(
            "EKG_ADMIN_PASSWORD must be configured before starting the backend. "
            "The API refuses to start without an administrator password."
        )
    return password


def database_path() -> Path:
    override = os.getenv("EKG_DB_PATH")
    return Path(override) if override else DEFAULT_DB_PATH
