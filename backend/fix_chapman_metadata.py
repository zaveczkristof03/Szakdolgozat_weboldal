"""Fix verified license and DOI metadata for the Chapman-Shaoxing/Ningbo ECG dataset."""
from __future__ import annotations
import json
import shutil
import sqlite3
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "ekg_metadata.db"
SEED_PATH = BASE_DIR / "catalog_seed.json"
BACKUP_DIR = BASE_DIR / "backups"
SOURCE_ID = "ecg-arrhythmia/1.0.0"
SOURCE_URL = "https://physionet.org/content/ecg-arrhythmia/1.0.0/"
LICENSE = "Creative Commons Attribution 4.0 International (CC BY 4.0)"
DOI = "10.13026/wgex-er52"
ACCESS = "Open access; use is subject to the CC BY 4.0 license terms."


def main() -> None:
    if not DB_PATH.exists() or not SEED_PATH.exists():
        raise SystemExit("Run this script from the backend folder; database or catalog_seed.json not found.")

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    BACKUP_DIR.mkdir(exist_ok=True)
    db_backup = BACKUP_DIR / f"ekg_metadata-before-chapman-fix-{stamp}.db"
    with sqlite3.connect(DB_PATH, timeout=15) as source, sqlite3.connect(db_backup) as target:
        source.backup(target)
    seed_backup = BACKUP_DIR / f"catalog_seed-before-chapman-fix-{stamp}.json"
    shutil.copy2(SEED_PATH, seed_backup)

    seed_rows = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    matched_seed = [row for row in seed_rows if row.get("source_database_id") == SOURCE_ID or row.get("source_url") == SOURCE_URL]
    if len(matched_seed) != 1:
        raise SystemExit(f"Expected exactly one matching seed row; found {len(matched_seed)}. No changes made to the seed.")
    row = matched_seed[0]
    row.update({"license": LICENSE, "doi": DOI, "access_conditions": ACCESS, "last_verified": "2026-10-29"})

    with sqlite3.connect(DB_PATH, timeout=15) as connection:
        connection.row_factory = sqlite3.Row
        columns = {item[1] for item in connection.execute('PRAGMA table_info("ecg_dataset_catalog")')}
        required = {"source_database_id", "source_url", "license", "doi", "access_conditions", "last_verified"}
        if not required.issubset(columns):
            raise SystemExit(f"Database is missing columns: {', '.join(sorted(required - columns))}")
        found = connection.execute(
            'SELECT id FROM "ecg_dataset_catalog" WHERE source_database_id = ? OR source_url = ?',
            (SOURCE_ID, SOURCE_URL),
        ).fetchall()
        if len(found) != 1:
            raise SystemExit(f"Expected exactly one matching database row; found {len(found)}. No database changes made.")
        connection.execute(
            'UPDATE "ecg_dataset_catalog" SET license = ?, doi = ?, access_conditions = ?, last_verified = ? WHERE id = ?',
            (LICENSE, DOI, ACCESS, "2026-10-29", found[0]["id"]),
        )
        connection.commit()

    SEED_PATH.write_text(json.dumps(seed_rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Database backup: {db_backup}")
    print(f"Seed backup: {seed_backup}")
    print("Chapman-Shaoxing and Ningbo metadata updated: license, DOI, access conditions.")
    print("Dataset ID, record count, frequency, leads, category, and description were not changed.")

if __name__ == "__main__":
    main()
