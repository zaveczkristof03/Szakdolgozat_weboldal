"""Safely refresh verified descriptive metadata for existing ECG catalog rows.

Run from the backend folder:
    .\.venv\Scripts\python.exe update_catalog_metadata.py

Requires catalog_seed.json (replace it with the improved version supplied with this script).
Creates a timestamped SQLite backup before making changes. Dataset IDs and the
core count/frequency/lead fields are intentionally not changed.
"""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path
from urllib.parse import urlsplit

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "ekg_metadata.db"
SEED_PATH = BASE_DIR / "catalog_seed.json"
BACKUP_DIR = BASE_DIR / "backups"
TABLE = "ecg_metadata_catalog"  # replaced below with the project's actual table name
TABLE = "ecg_dataset_catalog"

# Only these descriptive fields are updated; IDs and core numeric catalog values
# (records, frequency, leads, category) are left untouched.
UPDATE_FIELDS = (
    "description",
    "license",
    "last_verified",
    "short_name",
    "version",
    "doi",
    "records_label",
    "subject_count",
    "duration",
    "annotations",
    "file_format",
    "access_conditions",
    "source_database_id",
    "provenance_url",
)


def normalized_url(value: str | None) -> str:
    if not value:
        return ""
    parsed = urlsplit(value.strip())
    return f"{parsed.scheme.casefold()}://{parsed.netloc.casefold()}{parsed.path.rstrip('/')}"


def main() -> None:
    if not DB_PATH.exists():
        raise SystemExit(f"Database not found: {DB_PATH}")
    if not SEED_PATH.exists():
        raise SystemExit(f"Seed file not found: {SEED_PATH}")

    rows = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    if not isinstance(rows, list) or not rows:
        raise SystemExit("catalog_seed.json must contain a non-empty JSON list.")

    seen = set()
    for row in rows:
        if not row.get("source_url") or not row.get("name") or not row.get("description"):
            raise SystemExit(f"Missing required source_url/name/description in: {row.get('name', '<unnamed>')}")
        key = row.get("source_database_id") or normalized_url(row["source_url"])
        if key in seen:
            raise SystemExit(f"Duplicate source identifier in seed file: {key}")
        seen.add(key)

    BACKUP_DIR.mkdir(exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = BACKUP_DIR / f"ekg_metadata-before-catalog-metadata-{stamp}.db"
    # SQLite's backup API creates a consistent backup even if the app is open.
    with sqlite3.connect(DB_PATH, timeout=15) as source_db, sqlite3.connect(backup_path) as backup_db:
        source_db.backup(backup_db)
    print(f"Backup created: {backup_path}")

    updated = 0
    missing = []
    with sqlite3.connect(DB_PATH, timeout=15) as connection:
        connection.row_factory = sqlite3.Row
        columns = {r["name"] for r in connection.execute(f'PRAGMA table_info("{TABLE}")')}
        required = {"id", "source_url", "source_database_id", *UPDATE_FIELDS}
        missing_columns = sorted(required - columns)
        if missing_columns:
            raise SystemExit(f"Database schema is missing columns: {', '.join(missing_columns)}")

        for row in rows:
            existing = None
            source_id = row.get("source_database_id")
            if source_id:
                existing = connection.execute(
                    f'SELECT id, source_url FROM "{TABLE}" WHERE source_database_id = ?',
                    (source_id,),
                ).fetchone()
            if existing is None:
                target_url = normalized_url(row.get("source_url"))
                matches = connection.execute(
                    f'SELECT id, source_url FROM "{TABLE}"'
                ).fetchall()
                existing = next((item for item in matches if normalized_url(item["source_url"]) == target_url), None)

            if existing is None:
                missing.append(row["name"])
                continue

            # Do not erase existing values when a field is unknown/unverified in the seed.
            fields_to_update = [
                field for field in UPDATE_FIELDS
                if row.get(field) is not None and row.get(field) != ""
            ]
            if fields_to_update:
                assignments = ", ".join(f'"{field}" = ?' for field in fields_to_update)
                values = [row[field] for field in fields_to_update]
                connection.execute(
                    f'UPDATE "{TABLE}" SET {assignments} WHERE id = ?',
                    (*values, existing["id"]),
                )
            updated += 1

        connection.commit()

    print(f"Metadata updated: {updated}/{len(rows)}")
    print(f"Dataset rows not found (not inserted or deleted): {len(missing)}")
    for name in missing:
        print(f"  - {name}")
    print("Core dataset IDs, record counts, sampling frequencies, lead counts and categories were not changed.")
    print("Run the backend tests and export CSV to verify the results.")


if __name__ == "__main__":
    main()
