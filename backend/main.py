from __future__ import annotations


import os
import re
import secrets
import sqlite3
import time
import logging
from pathlib import Path
from typing import Any, Literal
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import AnyHttpUrl, BaseModel, Field, TypeAdapter, ValidationError, field_validator


# Keep using the existing SQLite file in the backend folder.
DB_PATH = Path(__file__).resolve().parent / "ekg_metadata.db"
CATALOG_TABLE = "ecg_dataset_catalog"
META_TABLE = "app_metadata"
ADMIN_TOKEN_TTL_SECONDS = 8 * 60 * 60
ACTIVE_ADMIN_TOKENS: dict[str, float] = {}
LOGIN_MAX_FAILURES = 5
LOGIN_FAILURE_WINDOW_SECONDS = 15 * 60
LOGIN_LOCKOUT_SECONDS = 15 * 60
FAILED_LOGIN_ATTEMPTS: dict[str, tuple[int, float, float]] = {}
SOURCE_URL_ADAPTER = TypeAdapter(AnyHttpUrl)
logger = logging.getLogger(__name__)


def configured_admin_password() -> str:
    """Return the mandatory admin password without ever logging its value."""
    password = os.getenv("EKG_ADMIN_PASSWORD")
    if password is None or not password.strip():
        raise RuntimeError(
            "EKG_ADMIN_PASSWORD must be configured before starting the backend. "
            "The API refuses to start without an administrator password."
        )
    return password


# Fail during startup instead of exposing write endpoints with an unsafe fallback.
ADMIN_PASSWORD = configured_admin_password()

app = FastAPI(
    title="EKG Metadata Explorer API",
    description="CRUD API for ECG dataset metadata.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class DatasetInput(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    records: int = Field(ge=0)
    frequency: int = Field(gt=0)
    leads: int = Field(gt=0)
    category: str = Field(min_length=1, max_length=150)
    source_url: str = Field(default="", max_length=1000)
    description: str = Field(default="", max_length=5000)
    license: str | None = Field(default=None, max_length=300)
    last_verified: str | None = Field(default=None, max_length=30)
    short_name: str | None = Field(default=None, max_length=100)
    version: str | None = Field(default=None, max_length=100)
    doi: str | None = Field(default=None, max_length=300)
    records_label: str | None = Field(default=None, max_length=100)
    subject_count: int | None = Field(default=None, ge=0)
    duration: str | None = Field(default=None, max_length=300)
    annotations: str | None = Field(default=None, max_length=2000)
    file_format: str | None = Field(default=None, max_length=300)
    access_conditions: str | None = Field(default=None, max_length=1000)
    source_database_id: str | None = Field(default=None, max_length=200)
    lightwave_database_id: str | None = Field(default=None, max_length=200)
    provenance_url: str | None = Field(default=None, max_length=1000)

    @field_validator("name", "category")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be empty.")
        return value

    @field_validator("source_url")
    @classmethod
    def validate_source_url(cls, value: str) -> str:
        return value.strip()

    @field_validator("source_url")
    @classmethod
    def require_http_source_url(cls, value: str) -> str:
        if not value:
            return ""

        try:
            return str(SOURCE_URL_ADAPTER.validate_python(value))
        except ValidationError as error:
            raise ValueError("Source URL must be a valid HTTP or HTTPS URL.") from error

    @field_validator("description")
    @classmethod
    def strip_description(cls, value: str) -> str:
        return value.strip()

    @field_validator(
        "license", "last_verified", "short_name", "version", "doi", "records_label",
        "duration", "annotations", "file_format", "access_conditions", "source_database_id",
        "lightwave_database_id", "provenance_url",
    )
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None

    @field_validator("provenance_url")
    @classmethod
    def validate_provenance_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        try:
            return str(SOURCE_URL_ADAPTER.validate_python(value))
        except ValidationError as error:
            raise ValueError("Provenance URL must be a valid HTTP or HTTPS URL.") from error


class DatasetRecord(DatasetInput):
    id: int


class DatasetPage(BaseModel):
    items: list[DatasetRecord]
    total: int
    page: int
    page_size: int


class AdminLoginInput(BaseModel):
    password: str = Field(min_length=1, max_length=500)


def connect() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def normalized_column_name(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", name.lower())


COLUMN_ALIASES: dict[str, tuple[str, ...]] = {
    "id": ("id", "datasetid", "ecgdatasetid"),
    "name": ("name", "datasetname", "title", "dbname"),
    "records": ("records", "recordcount", "numberofrecords", "numrecords", "nrecords"),
    "frequency": ("frequency", "samplingfrequency", "samplingfrequencyhz", "samplerate", "samplingrate", "hz"),
    "leads": ("leads", "numleads", "numberofleads", "leadcount", "nleads"),
    "category": ("category", "clinicalfocus", "focus", "condition", "diseasecategory"),
    "source_url": ("sourceurl", "url", "dataseturl", "officialurl", "source", "physioneturl"),
    "description": ("description", "summary", "details"),
    "license": ("license", "licensename", "licenseinfo", "licence"),
    "last_verified": ("lastverified", "verifiedat", "lastchecked", "lastverificationdate"),
}


def discover_legacy_table(connection: sqlite3.Connection) -> tuple[str, dict[str, str]] | None:
    tables = connection.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).fetchall()

    for table_row in tables:
        table_name = table_row["name"]
        if table_name in {CATALOG_TABLE, META_TABLE}:
            continue

        columns = connection.execute(
            f"PRAGMA table_info({quote_identifier(table_name)})"
        ).fetchall()
        lookup = {normalized_column_name(row["name"]): row["name"] for row in columns}
        mapping: dict[str, str] = {}

        for field_name, aliases in COLUMN_ALIASES.items():
            for alias in aliases:
                if alias in lookup:
                    mapping[field_name] = lookup[alias]
                    break

        # These are the fields needed to recognize a table containing dataset rows.
        if all(key in mapping for key in ("name", "records", "frequency", "leads")):
            return table_name, mapping

    return None


def quote_identifier(identifier: str) -> str:
    # Identifiers come from SQLite schema inspection, but still need quoting.
    return '"' + identifier.replace('"', '""') + '"'


def safe_integer(value: Any, default: int = 0) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError, OverflowError):
        return default


def create_schema(connection: sqlite3.Connection) -> None:
    connection.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {quote_identifier(CATALOG_TABLE)} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            records INTEGER NOT NULL DEFAULT 0,
            frequency INTEGER NOT NULL DEFAULT 250,
            leads INTEGER NOT NULL DEFAULT 2,
            category TEXT NOT NULL DEFAULT 'Uncategorized',
            source_url TEXT NOT NULL DEFAULT '',
            description TEXT NOT NULL DEFAULT '',
            license TEXT,
            last_verified TEXT,
            short_name TEXT,
            version TEXT,
            doi TEXT,
            records_label TEXT,
            subject_count INTEGER,
            duration TEXT,
            annotations TEXT,
            file_format TEXT,
            access_conditions TEXT,
            source_database_id TEXT,
            lightwave_database_id TEXT,
            provenance_url TEXT
        )
        """
    )
    connection.execute(
        f"CREATE INDEX IF NOT EXISTS idx_{CATALOG_TABLE}_name ON {quote_identifier(CATALOG_TABLE)} (name COLLATE NOCASE)"
    )
    connection.execute(
        f"CREATE TABLE IF NOT EXISTS {quote_identifier(META_TABLE)} (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
    )
    existing_columns = {
        row["name"]
        for row in connection.execute(
            f"PRAGMA table_info({quote_identifier(CATALOG_TABLE)})"
        ).fetchall()
    }
    extended_columns = {
        "short_name": "TEXT",
        "version": "TEXT",
        "doi": "TEXT",
        "records_label": "TEXT",
        "subject_count": "INTEGER",
        "duration": "TEXT",
        "annotations": "TEXT",
        "file_format": "TEXT",
        "access_conditions": "TEXT",
        "source_database_id": "TEXT",
        "lightwave_database_id": "TEXT",
        "provenance_url": "TEXT",
    }
    for column_name, column_type in extended_columns.items():
        if column_name not in existing_columns:
            connection.execute(
                f"ALTER TABLE {quote_identifier(CATALOG_TABLE)} "
                f"ADD COLUMN {quote_identifier(column_name)} {column_type}"
            )
    connection.commit()


def migrate_legacy_rows(connection: sqlite3.Connection) -> None:
    already_done = connection.execute(
        f"SELECT value FROM {quote_identifier(META_TABLE)} WHERE key = 'legacy_migration_done'"
    ).fetchone()
    if already_done and already_done["value"] == "1":
        return

    legacy = discover_legacy_table(connection)
    if legacy is None:
        # Don't mark as completed when no old table was found. This lets a future
        # compatible legacy table be detected, and does not alter any old tables.
        return

    legacy_table, mapping = legacy
    rows = connection.execute(
        f"SELECT * FROM {quote_identifier(legacy_table)}"
    ).fetchall()
    existing_count = connection.execute(
        f"SELECT COUNT(*) AS total FROM {quote_identifier(CATALOG_TABLE)}"
    ).fetchone()["total"]

    if existing_count == 0:
        for row in rows:
            def value_for(field: str, default: Any = None) -> Any:
                source_column = mapping.get(field)
                return row[source_column] if source_column is not None else default

            name = str(value_for("name", "")).strip()
            if not name:
                continue

            records = max(0, safe_integer(value_for("records"), 0))
            frequency = max(1, safe_integer(value_for("frequency"), 250))
            leads = max(1, safe_integer(value_for("leads"), 2))
            category = str(value_for("category", "Uncategorized") or "Uncategorized").strip()
            source_url = str(value_for("source_url", "") or "")
            description = str(value_for("description", "") or "")
            license_value = value_for("license")
            verified = value_for("last_verified")
            old_id = safe_integer(value_for("id"), 0)

            values = (
                name,
                records,
                frequency,
                leads,
                category or "Uncategorized",
                source_url,
                description,
                str(license_value).strip() if license_value else None,
                str(verified).strip() if verified else None,
            )

            if old_id > 0:
                collision = connection.execute(
                    f"SELECT 1 FROM {quote_identifier(CATALOG_TABLE)} WHERE id = ?",
                    (old_id,),
                ).fetchone()
                if not collision:
                    connection.execute(
                        f"""INSERT INTO {quote_identifier(CATALOG_TABLE)}
                        (id, name, records, frequency, leads, category, source_url, description, license, last_verified)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        (old_id, *values),
                    )
                    continue

            connection.execute(
                f"""INSERT INTO {quote_identifier(CATALOG_TABLE)}
                (name, records, frequency, leads, category, source_url, description, license, last_verified)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                values,
            )

    connection.execute(
        f"INSERT OR REPLACE INTO {quote_identifier(META_TABLE)} (key, value) VALUES ('legacy_migration_done', '1')"
    )
    connection.commit()


def initialize_database() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with connect() as connection:
        create_schema(connection)
        migrate_legacy_rows(connection)


def row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    result = dict(row)
    result["records"] = int(result["records"] or 0)
    result["frequency"] = int(result["frequency"] or 0)
    result["leads"] = int(result["leads"] or 0)
    return result


def ensure_unique_name(connection: sqlite3.Connection, name: str, exclude_id: int | None = None) -> None:
    query = f"SELECT id FROM {quote_identifier(CATALOG_TABLE)} WHERE name = ? COLLATE NOCASE"
    params: list[Any] = [name.strip()]
    if exclude_id is not None:
        query += " AND id != ?"
        params.append(exclude_id)
    if connection.execute(query, params).fetchone():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A dataset with this name already exists in the catalog.",
        )


def payload_values(payload: DatasetInput) -> tuple[Any, ...]:
    return (
        payload.name,
        payload.records,
        payload.frequency,
        payload.leads,
        payload.category,
        payload.source_url,
        payload.description,
        payload.license,
        payload.last_verified,
        payload.short_name,
        payload.version,
        payload.doi,
        payload.records_label,
        payload.subject_count,
        payload.duration,
        payload.annotations,
        payload.file_format,
        payload.access_conditions,
        payload.source_database_id,
        payload.lightwave_database_id,
        payload.provenance_url,
    )


@app.on_event("startup")
def on_startup() -> None:
    initialize_database()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def purge_expired_admin_tokens(now: float) -> None:
    expired_tokens = [token for token, expires_at in ACTIVE_ADMIN_TOKENS.items() if expires_at <= now]
    for token in expired_tokens:
        ACTIVE_ADMIN_TOKENS.pop(token, None)


def client_identifier(request: Request) -> str:
    return request.client.host if request.client else "unknown-client"


def login_retry_after(client_id: str, now: float) -> int | None:
    attempt_state = FAILED_LOGIN_ATTEMPTS.get(client_id)
    if attempt_state is None:
        return None

    failures, window_started, locked_until = attempt_state
    if locked_until > now:
        return max(1, int(locked_until - now))
    if now - window_started >= LOGIN_FAILURE_WINDOW_SECONDS:
        FAILED_LOGIN_ATTEMPTS.pop(client_id, None)
    return None


def record_failed_login(client_id: str, now: float) -> None:
    failures, window_started, locked_until = FAILED_LOGIN_ATTEMPTS.get(client_id, (0, now, 0.0))
    if now - window_started >= LOGIN_FAILURE_WINDOW_SECONDS:
        failures, window_started, locked_until = 0, now, 0.0

    failures += 1
    if failures >= LOGIN_MAX_FAILURES:
        locked_until = now + LOGIN_LOCKOUT_SECONDS
    FAILED_LOGIN_ATTEMPTS[client_id] = (failures, window_started, locked_until)


def require_admin(admin_token: str | None = Header(default=None, alias="X-Admin-Token")) -> str:
    """Require an unexpired token created by a successful admin login."""
    now = time.time()
    purge_expired_admin_tokens(now)

    if not admin_token or admin_token not in ACTIVE_ADMIN_TOKENS:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin login is required for catalog changes.",
        )
    return admin_token


@app.post("/admin/login")
def admin_login(payload: AdminLoginInput, request: Request, response: Response) -> dict[str, Any]:
    now = time.time()
    client_id = client_identifier(request)
    retry_after = login_retry_after(client_id, now)
    if retry_after is not None:
        logger.warning("Admin login rate limit reached for client %s", client_id)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )

    if not secrets.compare_digest(payload.password, ADMIN_PASSWORD):
        record_failed_login(client_id, now)
        logger.warning("Failed admin login for client %s", client_id)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin credentials.",
        )

    FAILED_LOGIN_ATTEMPTS.pop(client_id, None)
    purge_expired_admin_tokens(now)
    token = secrets.token_urlsafe(32)
    expires_at = now + ADMIN_TOKEN_TTL_SECONDS
    ACTIVE_ADMIN_TOKENS[token] = expires_at
    response.headers["Cache-Control"] = "no-store"
    logger.info("Admin login succeeded for client %s", client_id)
    return {"token": token, "expires_in": ADMIN_TOKEN_TTL_SECONDS}


@app.post("/admin/logout", status_code=status.HTTP_204_NO_CONTENT)
def admin_logout(admin_token: str = Depends(require_admin)) -> Response:
    ACTIVE_ADMIN_TOKENS.pop(admin_token, None)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/datasets", response_model=list[DatasetRecord])
def list_datasets() -> list[dict[str, Any]]:
    with connect() as connection:
        rows = connection.execute(
            f"SELECT * FROM {quote_identifier(CATALOG_TABLE)} ORDER BY name COLLATE NOCASE, id"
        ).fetchall()
    return [row_to_dict(row) for row in rows]


SORTABLE_DATASET_FIELDS = {
    "name": "name COLLATE NOCASE",
    "records": "records",
    "frequency": "frequency",
    "leads": "leads",
    "category": "category COLLATE NOCASE",
    "last_verified": "last_verified",
}


@app.get("/datasets/search", response_model=DatasetPage)
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
    clauses: list[str] = []
    parameters: list[Any] = []
    if q and q.strip():
        search_term = f"%{q.strip()}%"
        clauses.append(
            "(name LIKE ? COLLATE NOCASE OR short_name LIKE ? COLLATE NOCASE OR "
            "description LIKE ? COLLATE NOCASE OR category LIKE ? COLLATE NOCASE OR "
            "annotations LIKE ? COLLATE NOCASE)"
        )
        parameters.extend([search_term] * 5)
    for column, value in (("category", category), ("file_format", file_format), ("license", license), ("access_conditions", access_conditions)):
        if value and value.strip():
            clauses.append(f"{quote_identifier(column)} = ? COLLATE NOCASE")
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
    with connect() as connection:
        total = connection.execute(
            f"SELECT COUNT(*) AS total FROM {quote_identifier(CATALOG_TABLE)}{where}", parameters
        ).fetchone()["total"]
        rows = connection.execute(
            f"SELECT * FROM {quote_identifier(CATALOG_TABLE)}{where} "
            f"ORDER BY {SORTABLE_DATASET_FIELDS[sort_by]} {order}, id ASC LIMIT ? OFFSET ?",
            (*parameters, page_size, offset),
        ).fetchall()
    return DatasetPage(items=[row_to_dict(row) for row in rows], total=total, page=page, page_size=page_size)


@app.get("/datasets/{dataset_id}", response_model=DatasetRecord)
def get_dataset(dataset_id: int) -> dict[str, Any]:
    with connect() as connection:
        row = connection.execute(
            f"SELECT * FROM {quote_identifier(CATALOG_TABLE)} WHERE id = ?", (dataset_id,)
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found.")
    return row_to_dict(row)


@app.post("/datasets", response_model=DatasetRecord, status_code=status.HTTP_201_CREATED)
def create_dataset(payload: DatasetInput, _admin_token: str = Depends(require_admin)) -> dict[str, Any]:
    with connect() as connection:
        ensure_unique_name(connection, payload.name)
        cursor = connection.execute(
            f"""INSERT INTO {quote_identifier(CATALOG_TABLE)}
            (name, records, frequency, leads, category, source_url, description, license, last_verified,
             short_name, version, doi, records_label, subject_count, duration, annotations, file_format,
             access_conditions, source_database_id, lightwave_database_id, provenance_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            payload_values(payload),
        )
        connection.commit()
        row = connection.execute(
            f"SELECT * FROM {quote_identifier(CATALOG_TABLE)} WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
    return row_to_dict(row)


@app.put("/datasets/{dataset_id}", response_model=DatasetRecord)
def update_dataset(dataset_id: int, payload: DatasetInput, _admin_token: str = Depends(require_admin)) -> dict[str, Any]:
    with connect() as connection:
        existing = connection.execute(
            f"SELECT id FROM {quote_identifier(CATALOG_TABLE)} WHERE id = ?",
            (dataset_id,),
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found.")

        ensure_unique_name(connection, payload.name, exclude_id=dataset_id)
        connection.execute(
            f"""UPDATE {quote_identifier(CATALOG_TABLE)} SET
            name = ?, records = ?, frequency = ?, leads = ?, category = ?,
            source_url = ?, description = ?, license = ?, last_verified = ?,
            short_name = ?, version = ?, doi = ?, records_label = ?, subject_count = ?, duration = ?,
            annotations = ?, file_format = ?, access_conditions = ?, source_database_id = ?,
            lightwave_database_id = ?, provenance_url = ?
            WHERE id = ?""",
            (*payload_values(payload), dataset_id),
        )
        connection.commit()
        row = connection.execute(
            f"SELECT * FROM {quote_identifier(CATALOG_TABLE)} WHERE id = ?",
            (dataset_id,),
        ).fetchone()
    return row_to_dict(row)


@app.delete("/datasets/{dataset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dataset(dataset_id: int, _admin_token: str = Depends(require_admin)) -> Response:
    with connect() as connection:
        existing = connection.execute(
            f"SELECT id FROM {quote_identifier(CATALOG_TABLE)} WHERE id = ?",
            (dataset_id,),
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found.")

        connection.execute(
            f"DELETE FROM {quote_identifier(CATALOG_TABLE)} WHERE id = ?",
            (dataset_id,),
        )
        connection.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# Initialize on import too, so the API is ready with both normal and reload-based Uvicorn starts.
initialize_database()
