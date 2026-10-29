"""Idempotently import verified catalog additions from ``catalog_seed.json``."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

from main import CATALOG_TABLE, DB_PATH, create_schema, connect, quote_identifier

SEED_PATH = Path(__file__).with_name("catalog_seed.json")

# These IDs were individually checked against official PhysioNet dataset pages
# that expose the "Visualize waveforms" action.  Do not infer LightWAVE support
# merely from a dataset's PhysioNet content identifier.
VERIFIED_LIGHTWAVE_DATABASE_IDS = {
    "ltdb/1.0.0",
    "nsrdb/1.0.0",
    "nstdb/1.0.0",
}


def normalized_source_url(value: str) -> str:
    return value.strip().rstrip("/").casefold()


def seed_catalog(database_path: Path = DB_PATH) -> tuple[int, int]:
    """Insert only missing official source IDs/URLs and return (inserted, skipped)."""
    seed_rows: list[dict[str, Any]] = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    if database_path == DB_PATH:
        connection = connect()
    else:
        connection = sqlite3.connect(database_path)
        connection.row_factory = sqlite3.Row
    with connection:
        create_schema(connection)
        existing = connection.execute(
            f"SELECT source_url, source_database_id FROM {quote_identifier(CATALOG_TABLE)}"
        ).fetchall()
        known_urls = {normalized_source_url(row["source_url"]) for row in existing if row["source_url"]}
        known_ids = {row["source_database_id"] for row in existing if row["source_database_id"]}
        inserted = 0
        skipped = 0
        columns = (
            "name", "records", "frequency", "leads", "category", "source_url", "description", "license",
            "last_verified", "short_name", "version", "doi", "records_label", "subject_count", "duration",
            "annotations", "file_format", "access_conditions", "source_database_id", "lightwave_database_id", "provenance_url",
        )
        placeholders = ", ".join("?" for _ in columns)
        for row in seed_rows:
            if normalized_source_url(row["source_url"]) in known_urls or row["source_database_id"] in known_ids:
                skipped += 1
                continue
            values = [row.get(column) for column in columns]
            values[columns.index("description")] = row.get(
                "description",
                "Verified ECG dataset; consult the linked official source for full documentation.",
            )
            lightwave_index = columns.index("lightwave_database_id")
            if values[lightwave_index] not in VERIFIED_LIGHTWAVE_DATABASE_IDS:
                values[lightwave_index] = None
            connection.execute(
                f"INSERT INTO {quote_identifier(CATALOG_TABLE)} ({', '.join(columns)}) VALUES ({placeholders})",
                values,
            )
            known_urls.add(normalized_source_url(row["source_url"]))
            known_ids.add(row["source_database_id"])
            inserted += 1
        connection.commit()
    return inserted, skipped


if __name__ == "__main__":
    created, already_present = seed_catalog()
    print(f"Seed complete: {created} inserted, {already_present} already present.")
