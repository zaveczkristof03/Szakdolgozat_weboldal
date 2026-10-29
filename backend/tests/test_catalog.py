"""Catalog migration, seeding, querying, and preservation tests."""

from __future__ import annotations

import os
import sqlite3
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


BACKEND_DIRECTORY = Path(__file__).resolve().parents[1]
os.environ.setdefault("EKG_ADMIN_PASSWORD", "test-only-admin-password")
sys.path.insert(0, str(BACKEND_DIRECTORY))

import main  # noqa: E402
from seed_catalog import seed_catalog  # noqa: E402


ORIGINAL_DATASET_NAMES = {
    "MIT-BIH Arrhythmia",
    "PTB-XL",
    "MIT-BIH Atrial Fibrillation",
    "European ST-T Database",
}


@pytest.fixture
def catalog_client(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> TestClient:
    database_path = tmp_path / "catalog.db"
    monkeypatch.setattr(main, "DB_PATH", database_path)
    seed_catalog(database_path)
    with TestClient(main.app) as client:
        yield client


def test_original_four_records_are_preserved_in_project_database() -> None:
    database_path = BACKEND_DIRECTORY / "ekg_metadata.db"
    with sqlite3.connect(database_path) as connection:
        names = {row[0] for row in connection.execute("SELECT name FROM ecg_dataset_catalog")}
    assert ORIGINAL_DATASET_NAMES <= names


def test_seed_is_idempotent_and_has_at_least_twenty_total_records(tmp_path: Path) -> None:
    database_path = tmp_path / "seed.db"
    inserted, skipped = seed_catalog(database_path)
    repeated_inserted, repeated_skipped = seed_catalog(database_path)
    with sqlite3.connect(database_path) as connection:
        count = connection.execute("SELECT COUNT(*) FROM ecg_dataset_catalog").fetchone()[0]

    assert inserted >= 16
    assert skipped == 0
    assert repeated_inserted == 0
    assert repeated_skipped == inserted
    assert count >= 16


def test_search_filter_sort_and_pagination_are_server_side(catalog_client: TestClient) -> None:
    response = catalog_client.get(
        "/datasets/search",
        params={
            "q": "PTB",
            "min_frequency": 500,
            "file_format": "WFDB",
            "sort_by": "frequency",
            "sort_direction": "desc",
            "page": 1,
            "page_size": 2,
        },
    )

    assert response.status_code == 200
    page = response.json()
    assert page["total"] >= 1
    assert len(page["items"]) <= 2
    assert all(item["frequency"] >= 500 for item in page["items"])
    assert all("ptb" in item["name"].lower() for item in page["items"])


def test_dataset_detail_returns_extended_metadata(catalog_client: TestClient) -> None:
    listed = catalog_client.get("/datasets/search", params={"q": "Long Term ST"}).json()
    dataset_id = listed["items"][0]["id"]

    response = catalog_client.get(f"/datasets/{dataset_id}")

    assert response.status_code == 200
    dataset = response.json()
    assert dataset["short_name"] == "LTSTDB"
    assert dataset["source_database_id"] == "ltstdb/1.0.0"
    assert dataset["annotations"]
    assert dataset["lightwave_database_id"] is None


def test_seed_exposes_lightwave_only_for_individually_verified_ids(catalog_client: TestClient) -> None:
    datasets = catalog_client.get("/datasets/search", params={"page_size": 100}).json()["items"]
    linked_ids = {dataset["lightwave_database_id"] for dataset in datasets if dataset["lightwave_database_id"]}

    assert linked_ids == {"ltdb/1.0.0", "nsrdb/1.0.0", "nstdb/1.0.0"}
