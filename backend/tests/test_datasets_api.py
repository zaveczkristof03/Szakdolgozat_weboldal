"""A /datasets végpontok (csak olvasás) és a bejövő adatok ellenőrzése (Pydantic séma)."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas import DatasetInput


def full_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "name": "Test ECG Database", "short_name": "TEST", "records": 10, "records_label": "Test recordings",
        "subject_count": 8, "frequency": 360, "leads": 2, "category": "Arrhythmia", "duration": "30 minutes",
        "annotations": "Beat annotations", "file_format": "WFDB", "version": "1.0.0", "doi": "10.13026/TEST01",
        "source_database_id": "test/1.0.0", "source_url": "https://example.org/test/",
        "provenance_url": "https://example.org/test/", "license": "Open Data Commons Attribution License v1.0",
        "access_conditions": "Open access.", "lightwave_database_id": None, "last_verified": "2026-11-25",
        "description": "A test record.",
    }
    payload.update(overrides)
    return payload


def test_list_returns_the_full_catalog(catalog_client) -> None:
    response = catalog_client.get("/datasets")
    assert response.status_code == 200
    assert len(response.json()) == 21


def test_search_filter_sort_and_pagination_are_server_side(catalog_client) -> None:
    response = catalog_client.get("/datasets/search", params={
        "q": "PTB", "min_frequency": 500, "file_format": "WFDB",
        "sort_by": "frequency", "sort_direction": "desc", "page": 1, "page_size": 2})
    assert response.status_code == 200
    page = response.json()
    assert page["total"] >= 1
    assert len(page["items"]) <= 2
    assert all(item["frequency"] >= 500 for item in page["items"])
    frequencies = [item["frequency"] for item in page["items"]]
    assert frequencies == sorted(frequencies, reverse=True)


def test_dataset_detail_returns_extended_metadata(catalog_client) -> None:
    listed = catalog_client.get("/datasets/search", params={"q": "Long Term ST"}).json()
    dataset = catalog_client.get(f"/datasets/{listed['items'][0]['id']}").json()
    assert dataset["short_name"] == "LTSTDB"
    assert dataset["source_database_id"] == "ltstdb/1.0.0"
    assert dataset["records"] == 86
    assert dataset["subject_count"] == 80


def test_unknown_dataset_returns_404(catalog_client) -> None:
    assert catalog_client.get("/datasets/99999").status_code == 404


def test_api_is_read_only(catalog_client) -> None:
    """Az írás nem az API-n keresztül történik, hanem a catalog.json-ban."""
    assert catalog_client.post("/datasets", json=full_payload()).status_code == 405
    assert catalog_client.put("/datasets/1", json=full_payload()).status_code == 405
    assert catalog_client.delete("/datasets/1").status_code == 405
    assert catalog_client.get("/admin/login").status_code == 404


def test_missing_numbers_stay_missing_instead_of_defaults() -> None:
    record = DatasetInput.model_validate({"name": "Partially documented", "category": "Arrhythmia"})
    assert record.records is None
    assert record.frequency is None
    assert record.leads is None
    assert record.subject_count is None
    assert record.last_verified is None


def test_invalid_doi_and_date_are_rejected() -> None:
    with pytest.raises(ValidationError, match="DOI must look like"):
        DatasetInput.model_validate(full_payload(doi="not-a-doi"))
    with pytest.raises(ValidationError, match="YYYY-MM-DD"):
        DatasetInput.model_validate(full_payload(last_verified="29/10/2026"))


def test_doi_url_prefix_is_normalized() -> None:
    assert DatasetInput.model_validate(full_payload(doi="https://doi.org/10.13026/C2F305")).doi == "10.13026/C2F305"


def test_negative_counts_are_rejected() -> None:
    with pytest.raises(ValidationError):
        DatasetInput.model_validate(full_payload(records=-1))


@pytest.mark.parametrize("malicious_url", ["javascript:alert(1)", "data:text/html,test", "ftp://example.org/data"])
def test_non_http_source_urls_are_rejected(malicious_url: str) -> None:
    with pytest.raises(ValidationError):
        DatasetInput.model_validate(full_payload(source_url=malicious_url))
