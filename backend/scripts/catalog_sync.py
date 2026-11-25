"""A verziókezelt ``data/catalog.json`` és az SQLite adatbázis összehangolása.

Mit csinál?
- ``import``: a JSON rekordjait beírja az adatbázisba. Előtte automatikus mentés
  készül. A rekordot először ``id``, majd ``source_database_id`` alapján keresi;
  ha megvan, frissíti, ha nincs, beszúrja. SOHA nem töröl rekordot.
- ``export``: az adatbázis aktuális tartalmát kiírja a JSON-ba (pl. ha közvetlenül
  az adatbázisban javítottál valamit, és ezt verziókezelni szeretnéd).

Miért kell? Az ``ekg_metadata.db`` nincs a gitben (.gitignore), így a katalógus
egy friss klónból csak a JSON-ból építhető újra. A JSON az „igazság forrása”.

Futtatás a backend mappából:
    .\\.venv\\Scripts\\python.exe scripts\\catalog_sync.py import
    .\\.venv\\Scripts\\python.exe scripts\\catalog_sync.py export
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import config, db  # noqa: E402
from app.fields import FIELD_NAMES  # noqa: E402
from app.schemas import DatasetInput  # noqa: E402


def load_catalog(path: Path = config.CATALOG_JSON_PATH) -> list[dict[str, Any]]:
    rows = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(rows, list):
        raise SystemExit("catalog.json must contain a JSON list.")
    # Minden sort ugyanazzal a validációval ellenőrzünk, mint az API.
    for row in rows:
        DatasetInput.model_validate({name: row.get(name) for name in FIELD_NAMES if row.get(name) is not None})
    return rows


def import_catalog(database_path: Path | None = None, catalog_path: Path = config.CATALOG_JSON_PATH) -> tuple[int, int]:
    """Visszaadja: (beszúrt, frissített)."""
    database_path = database_path or db.DB_PATH
    rows = load_catalog(catalog_path)
    db.initialize_database(database_path)
    db.backup_database(database_path, "catalog-import")
    inserted = updated = 0
    with db.connect(database_path) as connection:
        for row in rows:
            values = [row.get(name) for name in FIELD_NAMES]
            existing = None
            if row.get("id") is not None:
                existing = connection.execute(f"SELECT id FROM {db.TABLE} WHERE id = ?", (row["id"],)).fetchone()
            if existing is None and row.get("source_database_id"):
                existing = connection.execute(
                    f"SELECT id FROM {db.TABLE} WHERE source_database_id = ?", (row["source_database_id"],)
                ).fetchone()
            if existing is not None:
                assignments = ", ".join(f"{name} = ?" for name in FIELD_NAMES)
                connection.execute(f"UPDATE {db.TABLE} SET {assignments} WHERE id = ?", (*values, existing["id"]))
                updated += 1
            else:
                columns = ["id", *FIELD_NAMES] if row.get("id") is not None else list(FIELD_NAMES)
                params = [row["id"], *values] if row.get("id") is not None else values
                connection.execute(
                    f"INSERT INTO {db.TABLE} ({', '.join(columns)}) VALUES ({', '.join('?' for _ in columns)})",
                    params,
                )
                inserted += 1
        connection.commit()
    return inserted, updated


def export_catalog(database_path: Path | None = None, catalog_path: Path = config.CATALOG_JSON_PATH) -> int:
    with db.connect(database_path or db.DB_PATH) as connection:
        rows = [db.row_to_dict(row) for row in connection.execute(f"SELECT * FROM {db.TABLE} ORDER BY id")]
    catalog_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return len(rows)


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    if command == "import":
        created, refreshed = import_catalog()
        print(f"Catalog import complete: {created} inserted, {refreshed} updated. Nothing was deleted.")
    elif command == "export":
        print(f"Exported {export_catalog()} records to {config.CATALOG_JSON_PATH}")
    else:
        raise SystemExit("Usage: python scripts/catalog_sync.py import|export")
