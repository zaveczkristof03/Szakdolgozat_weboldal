"""Bejövő és kimenő adatok ellenőrzése (Pydantic).

Mit csinál? Mielőtt bármi az adatbázisba kerülne, itt ellenőrizzük:
- a kötelező szövegek nem üresek,
- a számok nem negatívak, a hiányzó szám ``null`` (nem 0!),
- a DOI ``10.xxxx/...`` formátumú,
- a ``last_verified`` valódi dátum (ÉÉÉÉ-HH-NN),
- a linkek csak http(s) címek lehetnek (``javascript:`` stb. tiltva).
Ha valami nem stimmel, az API 422-es hibát ad, érthető üzenettel.
"""

from __future__ import annotations

import re
from datetime import date

from pydantic import AnyHttpUrl, BaseModel, Field, TypeAdapter, ValidationError, field_validator

URL_ADAPTER = TypeAdapter(AnyHttpUrl)
DOI_PATTERN = re.compile(r"^10\.\d{4,9}/\S+$")

OPTIONAL_TEXT_FIELDS = (
    "short_name", "records_label", "duration", "annotations", "file_format", "version", "doi",
    "source_database_id", "provenance_url", "license", "access_conditions",
    "lightwave_database_id", "last_verified",
)


def _http_url(value: str, label: str) -> str:
    try:
        return str(URL_ADAPTER.validate_python(value))
    except ValidationError as error:
        raise ValueError(f"{label} must be a valid HTTP or HTTPS URL.") from error


class DatasetInput(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    short_name: str | None = Field(default=None, max_length=100)
    # A hiányzó szám None marad: nem találunk ki 0-t, 250 Hz-et vagy 2 elvezetést.
    records: int | None = Field(default=None, ge=0)
    records_label: str | None = Field(default=None, max_length=100)
    subject_count: int | None = Field(default=None, ge=0)
    frequency: int | None = Field(default=None, gt=0)
    leads: int | None = Field(default=None, gt=0)
    category: str = Field(min_length=1, max_length=150)
    duration: str | None = Field(default=None, max_length=300)
    annotations: str | None = Field(default=None, max_length=2000)
    file_format: str | None = Field(default=None, max_length=300)
    version: str | None = Field(default=None, max_length=100)
    doi: str | None = Field(default=None, max_length=300)
    source_database_id: str | None = Field(default=None, max_length=200)
    source_url: str = Field(default="", max_length=1000)
    provenance_url: str | None = Field(default=None, max_length=1000)
    license: str | None = Field(default=None, max_length=300)
    access_conditions: str | None = Field(default=None, max_length=1000)
    lightwave_database_id: str | None = Field(default=None, max_length=200)
    last_verified: str | None = Field(default=None, max_length=30)
    description: str = Field(default="", max_length=5000)

    @field_validator("name", "category")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be empty.")
        return value

    @field_validator("description")
    @classmethod
    def strip_description(cls, value: str) -> str:
        return value.strip()

    @field_validator(*OPTIONAL_TEXT_FIELDS, mode="before")
    @classmethod
    def empty_text_is_missing(cls, value: object) -> object:
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value

    @field_validator("source_url")
    @classmethod
    def validate_source_url(cls, value: str) -> str:
        value = value.strip()
        return _http_url(value, "Source URL") if value else ""

    @field_validator("provenance_url")
    @classmethod
    def validate_provenance_url(cls, value: str | None) -> str | None:
        return None if value is None else _http_url(value, "Provenance URL")

    @field_validator("doi")
    @classmethod
    def validate_doi(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = re.sub(r"^(https?://(dx\.)?doi\.org/|doi:)", "", value, flags=re.IGNORECASE)
        if not DOI_PATTERN.match(value):
            raise ValueError("DOI must look like 10.xxxx/identifier.")
        return value

    @field_validator("last_verified")
    @classmethod
    def validate_last_verified(cls, value: str | None) -> str | None:
        if value is None:
            return None
        try:
            return date.fromisoformat(value).isoformat()
        except ValueError as error:
            raise ValueError("Last verified must be a date in YYYY-MM-DD format.") from error


class DatasetRecord(DatasetInput):
    id: int


class DatasetPage(BaseModel):
    items: list[DatasetRecord]
    total: int
    page: int
    page_size: int
