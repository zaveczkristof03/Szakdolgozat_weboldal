"""A katalógus mezőinek egyetlen, közös listája.

Miért kell? Korábban a mezőnevek három helyen (INSERT, UPDATE, seed) ismétlődtek;
ha valaki egy új mezőt csak az egyikbe írt be, csendben elveszett az adat.
Most minden SQL-utasítás és szkript ebből a listából dolgozik.

Fontos fogalmi különbség: a ``records`` a felvételek (rekordok) száma, a
``subject_count`` a vizsgálati személyeké. A kettő nem ugyanaz, ezért külön mező.
"""

from __future__ import annotations

CATALOG_TABLE = "ecg_dataset_catalog"
META_TABLE = "app_metadata"

# (oszlopnév, SQLite típus). Az ``id`` és a ``name`` külön kezelt.
CATALOG_COLUMNS: tuple[tuple[str, str], ...] = (
    ("name", "TEXT NOT NULL"),
    ("short_name", "TEXT"),
    ("records", "INTEGER"),            # rekordok (felvételek) száma
    ("records_label", "TEXT"),         # mit jelent itt egy „rekord”
    ("subject_count", "INTEGER"),      # személyek száma – NEM azonos a rekordszámmal
    ("frequency", "INTEGER"),          # mintavételezési frekvencia (Hz)
    ("leads", "INTEGER"),              # EKG-elvezetések száma
    ("category", "TEXT NOT NULL"),     # klinikai fókusz
    ("duration", "TEXT"),
    ("annotations", "TEXT"),
    ("file_format", "TEXT"),
    ("version", "TEXT"),
    ("doi", "TEXT"),
    ("source_database_id", "TEXT"),    # pl. "mitdb/1.0.0"
    ("source_url", "TEXT NOT NULL DEFAULT ''"),
    ("provenance_url", "TEXT"),
    ("license", "TEXT"),
    ("access_conditions", "TEXT"),
    ("lightwave_database_id", "TEXT"),  # csak a PhysioNeten igazolt LightWAVE-azonosító
    ("last_verified", "TEXT"),          # ISO dátum: ÉÉÉÉ-HH-NN
    ("description", "TEXT NOT NULL DEFAULT ''"),
)

FIELD_NAMES: tuple[str, ...] = tuple(name for name, _ in CATALOG_COLUMNS)

SORTABLE_FIELDS = {
    "name": "name COLLATE NOCASE",
    "records": "records",
    "frequency": "frequency",
    "leads": "leads",
    "category": "category COLLATE NOCASE",
    "last_verified": "last_verified",
}
