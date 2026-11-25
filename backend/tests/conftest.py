"""Közös tesztbeállítások.

Minden teszt egy IDEIGLENES adatbázist kap, így az éles ``ekg_metadata.db``
fájlt a tesztek soha nem olvassák és nem írják.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

BACKEND_DIRECTORY = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIRECTORY))

from app import db  # noqa: E402
from app.main import app  # noqa: E402
from scripts.catalog_sync import import_catalog  # noqa: E402


@pytest.fixture
def empty_client(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "test.db")
    with TestClient(app) as client:
        yield client


@pytest.fixture
def catalog_client(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    database_path = tmp_path / "catalog.db"
    monkeypatch.setattr(db, "DB_PATH", database_path)
    import_catalog(database_path)
    with TestClient(app) as client:
        yield client
