"""A 2. sémamigráció tesztje: a régi, NOT NULL + alapértékes tábla átalakítása."""

from __future__ import annotations

import sqlite3
from pathlib import Path

from app import db

OLD_SCHEMA = """
CREATE TABLE ecg_dataset_catalog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    records INTEGER NOT NULL DEFAULT 0,
    frequency INTEGER NOT NULL DEFAULT 250,
    leads INTEGER NOT NULL DEFAULT 2,
    category TEXT NOT NULL DEFAULT 'Uncategorized',
    source_url TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    license TEXT,
    last_verified TEXT
)
"""


def test_v1_database_becomes_nullable_and_keeps_its_values(tmp_path: Path) -> None:
    database_path = tmp_path / "ekg_metadata.db"
    with sqlite3.connect(database_path) as connection:
        connection.execute(OLD_SCHEMA)
        connection.execute(
            "INSERT INTO ecg_dataset_catalog (id, name, records, frequency, leads, category) VALUES (7, 'Old', 48, 360, 2, 'Arrhythmia')"
        )
        connection.commit()

    db.initialize_database(database_path)

    with sqlite3.connect(database_path) as connection:
        connection.row_factory = sqlite3.Row
        columns = {row["name"]: row for row in connection.execute("PRAGMA table_info(ecg_dataset_catalog)")}
        assert not columns["records"]["notnull"]
        assert not columns["frequency"]["notnull"]
        assert columns["frequency"]["dflt_value"] is None
        row = connection.execute("SELECT * FROM ecg_dataset_catalog WHERE id = 7").fetchone()
        assert (row["name"], row["records"], row["frequency"], row["leads"]) == ("Old", 48, 360, 2)
        assert "doi" in columns
        connection.execute("INSERT INTO ecg_dataset_catalog (name, category) VALUES ('New', 'Test')")
        new_row = connection.execute("SELECT frequency, leads FROM ecg_dataset_catalog WHERE name = 'New'").fetchone()
        assert (new_row["frequency"], new_row["leads"]) == (None, None)

    backups = list((tmp_path / "backups").glob("ekg_metadata-before-schema-v2-*.db"))
    assert len(backups) == 1


def test_initialization_is_repeatable(tmp_path: Path) -> None:
    database_path = tmp_path / "fresh.db"
    db.initialize_database(database_path)
    db.initialize_database(database_path)
    assert not (tmp_path / "backups").exists()
