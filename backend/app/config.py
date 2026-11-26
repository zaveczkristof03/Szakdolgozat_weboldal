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
# Valódi EKG-jelrészletek a PhysioNetről (scripts/fetch_ecg_samples.py készíti).
ECG_SAMPLES_PATH = BACKEND_DIR / "data" / "ecg_samples.json"
BACKUP_DIR = BACKEND_DIR / "backups"

CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
]


def database_path() -> Path:
    override = os.getenv("EKG_DB_PATH")
    return Path(override) if override else DEFAULT_DB_PATH
