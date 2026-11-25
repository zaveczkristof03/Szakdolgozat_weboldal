"""A /datasets végpontok: olvasás, keresés, létrehozás, szerkesztés, törlés, validáció."""

from __future__ import annotations

from conftest import login


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


def test_missing_numbers_stay_missing_instead_of_defaults(empty_client) -> None:
    response = empty_client.post("/datasets", json={"name": "Partially documented", "category": "Arrhythmia"}, headers=login(empty_client))
    assert response.status_code == 201
    body = response.json()
    assert body["records"] is None
    assert body["frequency"] is None
    assert body["leads"] is None
    assert body["subject_count"] is None
    assert body["last_verified"] is None


def test_update_replaces_every_field_and_keeps_extended_metadata(empty_client) -> None:
    headers = login(empty_client)
    created = empty_client.post("/datasets", json=full_payload(), headers=headers).json()
    response = empty_client.put(f"/datasets/{created['id']}", json=full_payload(records=12, version="1.0.1"), headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["records"] == 12
    assert body["version"] == "1.0.1"
    assert body["doi"] == "10.13026/TEST01"
    assert body["annotations"] == "Beat annotations"
    assert body["subject_count"] == 8


def test_duplicate_names_are_rejected(empty_client) -> None:
    headers = login(empty_client)
    assert empty_client.post("/datasets", json=full_payload(), headers=headers).status_code == 201
    assert empty_client.post("/datasets", json=full_payload(name="test ecg database"), headers=headers).status_code == 409


def test_delete_removes_the_record(empty_client) -> None:
    headers = login(empty_client)
    created = empty_client.post("/datasets", json=full_payload(), headers=headers).json()
    assert empty_client.delete(f"/datasets/{created['id']}", headers=headers).status_code == 204
    assert empty_client.get(f"/datasets/{created['id']}").status_code == 404
    assert empty_client.delete(f"/datasets/{created['id']}", headers=headers).status_code == 404


def test_invalid_doi_and_date_are_rejected(empty_client) -> None:
    headers = login(empty_client)
    bad_doi = empty_client.post("/datasets", json=full_payload(doi="not-a-doi"), headers=headers)
    assert bad_doi.status_code == 422
    assert "DOI must look like" in bad_doi.text
    bad_date = empty_client.post("/datasets", json=full_payload(last_verified="29/10/2026"), headers=headers)
    assert bad_date.status_code == 422
    assert "YYYY-MM-DD" in bad_date.text


def test_doi_url_prefix_is_normalized(empty_client) -> None:
    response = empty_client.post("/datasets", json=full_payload(doi="https://doi.org/10.13026/C2F305"), headers=login(empty_client))
    assert response.json()["doi"] == "10.13026/C2F305"


def test_negative_counts_are_rejected(empty_client) -> None:
    response = empty_client.post("/datasets", json=full_payload(records=-1), headers=login(empty_client))
    assert response.status_code == 422
