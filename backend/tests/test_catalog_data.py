"""A verziókezelt katalógus (data/catalog.json) adatminőségi tesztjei.

Ezek nem a programot, hanem az ADATOT ellenőrzik: ha valaki hibás DOI-t vagy
ellentmondó értéket ír a JSON-ba, a teszt megbukik.
"""

from __future__ import annotations

import re
import sqlite3
from pathlib import Path

from app import db
from scripts.catalog_sync import export_catalog, import_catalog, load_catalog

KNOWN_LICENSES = {
    "Open Data Commons Attribution License v1.0",
    "Creative Commons Attribution 4.0 International Public License",
}


def test_catalog_contains_all_21_datasets_with_unique_identifiers() -> None:
    rows = load_catalog()
    assert len(rows) == 21
    assert len({row["name"].casefold() for row in rows}) == 21
    assert len({row["source_database_id"] for row in rows}) == 21
    assert len({row["id"] for row in rows}) == 21


def test_dois_are_well_formed() -> None:
    for row in load_catalog():
        assert row["doi"] is None or re.match(r"^10\.\d{4,9}/\S+$", row["doi"]), row["name"]


def test_licenses_use_one_normalized_name_each() -> None:
    assert {row["license"] for row in load_catalog()} <= KNOWN_LICENSES


def test_records_and_subjects_are_kept_as_separate_values() -> None:
    for row in load_catalog():
        assert row["records"] is None or isinstance(row["records"], int)
        assert row["subject_count"] is None or isinstance(row["subject_count"], int)
    mitdb = next(row for row in load_catalog() if row["short_name"] == "MITDB")
    assert (mitdb["records"], mitdb["subject_count"]) == (48, 47)


def test_lightwave_ids_match_the_source_database_id() -> None:
    # A LightWAVE-link csak a PhysioNet „Visualize waveforms” linkje alapján igazolt ID-vel jelenhet meg.
    for row in load_catalog():
        if row["lightwave_database_id"] is not None:
            assert row["lightwave_database_id"] == row["source_database_id"], row["name"]
    cinc = next(row for row in load_catalog() if row["short_name"] == "CINC2017")
    assert cinc["lightwave_database_id"] is None


def test_import_is_idempotent_and_never_deletes(tmp_path: Path) -> None:
    database_path = tmp_path / "import.db"
    assert import_catalog(database_path) == (21, 0)
    assert import_catalog(database_path) == (0, 21)
    with sqlite3.connect(database_path) as connection:
        connection.execute(f"INSERT INTO {db.TABLE} (name, category) VALUES ('Local only', 'Test')")
        connection.commit()
    import_catalog(database_path)
    with sqlite3.connect(database_path) as connection:
        assert connection.execute(f"SELECT COUNT(*) FROM {db.TABLE}").fetchone()[0] == 22


def test_export_round_trip(tmp_path: Path) -> None:
    database_path = tmp_path / "roundtrip.db"
    import_catalog(database_path)
    exported = tmp_path / "exported.json"
    assert export_catalog(database_path, exported) == 21
    assert load_catalog(exported) == load_catalog()
