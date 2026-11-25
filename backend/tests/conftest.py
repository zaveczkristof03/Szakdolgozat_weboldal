"""Közös tesztbeállítások.

Minden teszt egy IDEIGLENES adatbázist kap, így az éles ``ekg_metadata.db``
fájlt a tesztek soha nem olvassák és nem írják.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

BACKEND_DIRECTORY = Path(__file__).resolve().parents[1]
os.environ.setdefault("EKG_ADMIN_PASSWORD", "test-only-admin-password")
sys.path.insert(0, str(BACKEND_DIRECTORY))

from app import db, security  # noqa: E402
from app.main import app  # noqa: E402
from scripts.catalog_sync import import_catalog  # noqa: E402

ADMIN_PASSWORD = "test-only-admin-password"


@pytest.fixture
def empty_client(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "test.db")
    security.ACTIVE_ADMIN_TOKENS.clear()
    security.FAILED_LOGIN_ATTEMPTS.clear()
    with TestClient(app) as client:
        yield client
    security.ACTIVE_ADMIN_TOKENS.clear()
    security.FAILED_LOGIN_ATTEMPTS.clear()


@pytest.fixture
def catalog_client(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    database_path = tmp_path / "catalog.db"
    monkeypatch.setattr(db, "DB_PATH", database_path)
    import_catalog(database_path)
    security.ACTIVE_ADMIN_TOKENS.clear()
    with TestClient(app) as client:
        yield client
    security.ACTIVE_ADMIN_TOKENS.clear()


def login(client: TestClient) -> dict[str, str]:
    response = client.post("/admin/login", json={"password": ADMIN_PASSWORD})
    assert response.status_code == 200
    return {"X-Admin-Token": response.json()["token"]}
