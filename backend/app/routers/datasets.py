"""A ``/datasets`` végpontok: listázás, keresés, adatlap. Az API csak olvasható.

Az adatok forrása a verziókezelt ``data/catalog.json``; módosítani ott kell, majd
``python scripts/catalog_sync.py import`` frissíti az adatbázist.
Minden SQL paraméterezett (``?``), így a felhasználói szöveg nem tud SQL-t futtatni.
"""

from __future__ import annotations

import json
import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Query, status

from .. import config, db
from ..fields import SORTABLE_FIELDS
from ..schemas import DatasetPage, DatasetRecord

router = APIRouter(prefix="/datasets", tags=["datasets"])


def require_existing(connection: sqlite3.Connection, dataset_id: int) -> sqlite3.Row:
    row = db.fetch_dataset(connection, dataset_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found.")
    return row


@router.get("", response_model=list[DatasetRecord])
def list_datasets() -> list[dict[str, Any]]:
    """A teljes katalógus. A frontend ezt tölti be egyszer, és kliensoldalon szűr."""
    with db.connect() as connection:
        rows = connection.execute(f"SELECT * FROM {db.TABLE} ORDER BY name COLLATE NOCASE, id").fetchall()
    return [db.row_to_dict(row) for row in rows]


@router.get("/search", response_model=DatasetPage)
def search_datasets(
    q: str | None = Query(default=None, max_length=200),
    category: str | None = Query(default=None, max_length=150),
    min_frequency: int | None = Query(default=None, ge=1),
    leads: int | None = Query(default=None, ge=1),
    file_format: str | None = Query(default=None, max_length=300),
    license: str | None = Query(default=None, max_length=300),
    access_conditions: str | None = Query(default=None, max_length=1000),
    sort_by: Literal["name", "records", "frequency", "leads", "category", "last_verified"] = "name",
    sort_direction: Literal["asc", "desc"] = "asc",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
) -> DatasetPage:
    """Szerveroldali keresés lapozással (más kliensek, pl. szkriptek számára)."""
    clauses: list[str] = []
    parameters: list[Any] = []
    if q and q.strip():
        term = f"%{q.strip()}%"
        clauses.append(
            "(name LIKE ? COLLATE NOCASE OR short_name LIKE ? COLLATE NOCASE OR "
            "description LIKE ? COLLATE NOCASE OR category LIKE ? COLLATE NOCASE OR "
            "annotations LIKE ? COLLATE NOCASE)"
        )
        parameters.extend([term] * 5)
    for column, value in (("category", category), ("file_format", file_format), ("license", license), ("access_conditions", access_conditions)):
        if value and value.strip():
            clauses.append(f"{column} = ? COLLATE NOCASE")
            parameters.append(value.strip())
    if min_frequency is not None:
        clauses.append("frequency >= ?")
        parameters.append(min_frequency)
    if leads is not None:
        clauses.append("leads = ?")
        parameters.append(leads)

    where = f" WHERE {' AND '.join(clauses)}" if clauses else ""
    order = "DESC" if sort_direction == "desc" else "ASC"
    offset = (page - 1) * page_size
    with db.connect() as connection:
        total = connection.execute(f"SELECT COUNT(*) AS total FROM {db.TABLE}{where}", parameters).fetchone()["total"]
        rows = connection.execute(
            f"SELECT * FROM {db.TABLE}{where} ORDER BY {SORTABLE_FIELDS[sort_by]} {order}, id ASC LIMIT ? OFFSET ?",
            (*parameters, page_size, offset),
        ).fetchall()
    return DatasetPage(items=[db.row_to_dict(row) for row in rows], total=total, page=page, page_size=page_size)


@router.get("/{dataset_id}", response_model=DatasetRecord)
def get_dataset(dataset_id: int) -> dict[str, Any]:
    with db.connect() as connection:
        return db.row_to_dict(require_existing(connection, dataset_id))


def load_ecg_samples() -> dict[str, Any]:
    """A letöltött jelrészletek. Ha a fájl nincs meg, üres: ilyenkor nincs mit mutatni."""
    path = config.ECG_SAMPLES_PATH
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8")).get("samples", {})


@router.get("/{dataset_id}/ecg-sample")
def get_ecg_sample(dataset_id: int) -> dict[str, Any]:
    """Egy valódi, 3 másodperces jelrészlet a forrásból. 404, ha nincs letöltve.

    A frontend 404 esetén egyszerűen nem rajzol semmit: a hiányzó jelet nem pótoljuk.
    """
    with db.connect() as connection:
        row = db.row_to_dict(require_existing(connection, dataset_id))
    sample = load_ecg_samples().get(row.get("source_database_id") or "")
    if sample is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No ECG sample for this dataset.")
    return {"source_database_id": row["source_database_id"], **sample}
