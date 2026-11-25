"""SQLite kapcsolat és séma.

Mit csinál?
- ``connect()`` megnyit egy kapcsolatot, és a ``with`` blokk végén LEZÁRJA.
  (A sima ``sqlite3.connect`` ``with`` blokkja csak commitol, nem zár.)
- ``initialize_database()`` létrehozza a táblákat, és lefuttatja a még
  hiányzó migrációkat.

Migráció = egyszeri, számozott sémamódosítás. A ``app_metadata`` táblában
tároljuk, hogy hányadik verziónál tart az adatbázis, így minden lépés csak
egyszer fut le. Minden olyan migráció előtt, amely a meglévő táblát átépíti,
automatikus biztonsági mentés készül a ``backups/`` mappába.
"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Iterator

from . import config
from .fields import CATALOG_COLUMNS, CATALOG_TABLE, FIELD_NAMES, META_TABLE

# A tesztek ezt átállítják egy ideiglenes fájlra.
DB_PATH: Path = config.database_path()

SCHEMA_VERSION = 2


def quote_identifier(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


TABLE = quote_identifier(CATALOG_TABLE)


@contextmanager
def connect(path: Path | None = None) -> Iterator[sqlite3.Connection]:
    connection = sqlite3.connect(path or DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        yield connection
    finally:
        connection.close()


def _catalog_table_sql(table_name: str) -> str:
    columns = ",\n    ".join(f"{quote_identifier(name)} {kind}" for name, kind in CATALOG_COLUMNS)
    return (
        f"CREATE TABLE IF NOT EXISTS {quote_identifier(table_name)} (\n"
        f"    id INTEGER PRIMARY KEY AUTOINCREMENT,\n    {columns}\n)"
    )


def _schema_version(connection: sqlite3.Connection) -> int:
    row = connection.execute(
        f"SELECT value FROM {quote_identifier(META_TABLE)} WHERE key = 'schema_version'"
    ).fetchone()
    return int(row["value"]) if row else 1


def _set_schema_version(connection: sqlite3.Connection, version: int) -> None:
    connection.execute(
        f"INSERT OR REPLACE INTO {quote_identifier(META_TABLE)} (key, value) VALUES ('schema_version', ?)",
        (str(version),),
    )


def backup_database(path: Path, label: str) -> Path | None:
    """Konzisztens másolat az SQLite backup API-val. Üres/új DB-nél nem készít mentést."""
    if not path.exists() or path.stat().st_size == 0:
        return None
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    target = path.parent / "backups" / f"{path.stem}-before-{label}-{stamp}.db"
    target.parent.mkdir(parents=True, exist_ok=True)
    with connect(path) as source, connect(target) as destination:
        source.backup(destination)
    return target


def _existing_columns(connection: sqlite3.Connection) -> dict[str, sqlite3.Row]:
    return {row["name"]: row for row in connection.execute(f"PRAGMA table_info({TABLE})")}


def _migrate_to_v2(connection: sqlite3.Connection, path: Path) -> None:
    """2. migráció: a rekordszám, frekvencia és elvezetésszám nullázható lesz.

    Miért? Korábban ezek NOT NULL mezők voltak 0 / 250 / 2 alapértékkel, így egy
    nem ismert értéket a rendszer csendben „kitalált”. Az új séma szerint a
    hiányzó érték NULL, és a felületen „Not recorded”-ként látszik.
    A meglévő értékek változatlanul átkerülnek.
    """
    columns = _existing_columns(connection)
    needs_rebuild = any(columns.get(name) is not None and columns[name]["notnull"] for name in ("records", "frequency", "leads"))
    if not needs_rebuild:
        return

    backup_database(path, "schema-v2")
    present = [name for name in FIELD_NAMES if name in columns]
    column_list = ", ".join(["id", *present])
    connection.execute("BEGIN")
    connection.execute(_catalog_table_sql(f"{CATALOG_TABLE}_v2"))
    connection.execute(
        f"INSERT INTO {quote_identifier(CATALOG_TABLE + '_v2')} ({column_list}) SELECT {column_list} FROM {TABLE}"
    )
    connection.execute(f"DROP TABLE {TABLE}")
    connection.execute(f"ALTER TABLE {quote_identifier(CATALOG_TABLE + '_v2')} RENAME TO {TABLE}")
    connection.commit()


def initialize_database(path: Path | None = None) -> None:
    path = path or DB_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    with connect(path) as connection:
        connection.execute(_catalog_table_sql(CATALOG_TABLE))
        connection.execute(
            f"CREATE TABLE IF NOT EXISTS {quote_identifier(META_TABLE)} (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
        )
        # Régebbi adatbázisokban hiányozhatnak a később felvett oszlopok.
        existing = _existing_columns(connection)
        for name, kind in CATALOG_COLUMNS:
            if name not in existing:
                plain_kind = kind.replace(" NOT NULL", "")
                connection.execute(f"ALTER TABLE {TABLE} ADD COLUMN {quote_identifier(name)} {plain_kind}")
        connection.commit()

        if _schema_version(connection) < 2:
            _migrate_to_v2(connection, path)
        _set_schema_version(connection, SCHEMA_VERSION)
        connection.execute(
            f"CREATE INDEX IF NOT EXISTS idx_{CATALOG_TABLE}_name ON {TABLE} (name COLLATE NOCASE)"
        )
        connection.commit()


def row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {"id": row["id"], **{name: row[name] for name in FIELD_NAMES}}


def fetch_dataset(connection: sqlite3.Connection, dataset_id: int) -> sqlite3.Row | None:
    return connection.execute(f"SELECT * FROM {TABLE} WHERE id = ?", (dataset_id,)).fetchone()
