"""A ``/datasets`` végpontok: listázás, keresés, adatlap, létrehozás, szerkesztés, törlés.

Az olvasás bárkinek szabad; az írás (POST, PUT, DELETE) admin tokent kér.
Minden SQL paraméterezett (``?``), így a felhasználói szöveg nem tud SQL-t futtatni.
"""

from __future__ import annotations

import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from .. import db
from ..fields import FIELD_NAMES, SORTABLE_FIELDS
from ..schemas import DatasetInput, DatasetPage, DatasetRecord
from ..security import require_admin

router = APIRouter(prefix="/datasets", tags=["datasets"])

COLUMN_LIST = ", ".join(FIELD_NAMES)
PLACEHOLDERS = ", ".join("?" for _ in FIELD_NAMES)
ASSIGNMENTS = ", ".join(f"{name} = ?" for name in FIELD_NAMES)


def payload_values(payload: DatasetInput) -> tuple[Any, ...]:
    data = payload.model_dump()
    return tuple(data[name] for name in FIELD_NAMES)


def ensure_unique_name(connection: sqlite3.Connection, name: str, exclude_id: int | None = None) -> None:
    query = f"SELECT id FROM {db.TABLE} WHERE name = ? COLLATE NOCASE"
    params: list[Any] = [name.strip()]
    if exclude_id is not None:
        query += " AND id != ?"
        params.append(exclude_id)
    if connection.execute(query, params).fetchone():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A dataset with this name already exists in the catalog.",
        )


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


@router.post("", response_model=DatasetRecord, status_code=status.HTTP_201_CREATED)
def create_dataset(payload: DatasetInput, _admin_token: str = Depends(require_admin)) -> dict[str, Any]:
    with db.connect() as connection:
        ensure_unique_name(connection, payload.name)
        cursor = connection.execute(
            f"INSERT INTO {db.TABLE} ({COLUMN_LIST}) VALUES ({PLACEHOLDERS})",
            payload_values(payload),
        )
        connection.commit()
        return db.row_to_dict(require_existing(connection, int(cursor.lastrowid)))


@router.put("/{dataset_id}", response_model=DatasetRecord)
def update_dataset(dataset_id: int, payload: DatasetInput, _admin_token: str = Depends(require_admin)) -> dict[str, Any]:
    """Teljes csere: a kérésnek az összes mezőt tartalmaznia kell (a frontend űrlap ezt teszi)."""
    with db.connect() as connection:
        require_existing(connection, dataset_id)
        ensure_unique_name(connection, payload.name, exclude_id=dataset_id)
        connection.execute(
            f"UPDATE {db.TABLE} SET {ASSIGNMENTS} WHERE id = ?",
            (*payload_values(payload), dataset_id),
        )
        connection.commit()
        return db.row_to_dict(require_existing(connection, dataset_id))


@router.delete("/{dataset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dataset(dataset_id: int, _admin_token: str = Depends(require_admin)) -> Response:
    with db.connect() as connection:
        require_existing(connection, dataset_id)
        connection.execute(f"DELETE FROM {db.TABLE} WHERE id = ?", (dataset_id,))
        connection.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
