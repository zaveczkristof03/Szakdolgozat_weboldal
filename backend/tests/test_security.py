"""Focused security tests for administrator access and external source URLs."""

from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


BACKEND_DIRECTORY = Path(__file__).resolve().parents[1]
os.environ.setdefault("EKG_ADMIN_PASSWORD", "test-only-admin-password")
sys.path.insert(0, str(BACKEND_DIRECTORY))

import main  # noqa: E402


def dataset_payload(source_url: str = "https://example.org/datasets/test") -> dict[str, object]:
    return {
        "name": "Security test dataset",
        "records": 1,
        "frequency": 250,
        "leads": 1,
        "category": "Test",
        "source_url": source_url,
        "description": "Temporary test record.",
    }


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> TestClient:
    monkeypatch.setattr(main, "DB_PATH", tmp_path / "test_catalog.db")
    main.ACTIVE_ADMIN_TOKENS.clear()
    main.FAILED_LOGIN_ATTEMPTS.clear()

    with TestClient(main.app) as test_client:
        yield test_client

    main.ACTIVE_ADMIN_TOKENS.clear()
    main.FAILED_LOGIN_ATTEMPTS.clear()


def admin_token(client: TestClient) -> str:
    response = client.post("/admin/login", json={"password": "test-only-admin-password"})
    assert response.status_code == 200
    return response.json()["token"]


def test_backend_refuses_to_import_without_admin_password() -> None:
    environment = os.environ.copy()
    environment.pop("EKG_ADMIN_PASSWORD", None)
    import_script = f"import sys; sys.path.insert(0, {str(BACKEND_DIRECTORY)!r}); import main"

    result = subprocess.run(
        [sys.executable, "-c", import_script],
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode != 0
    assert "EKG_ADMIN_PASSWORD must be configured" in result.stderr


def test_catalog_writes_require_an_admin_token(client: TestClient) -> None:
    response = client.post("/datasets", json=dataset_payload())

    assert response.status_code == 401
    assert response.json()["detail"] == "Admin login is required for catalog changes."


def test_successful_login_issues_a_non_cacheable_token(client: TestClient) -> None:
    response = client.post("/admin/login", json={"password": "test-only-admin-password"})

    assert response.status_code == 200
    body = response.json()
    assert isinstance(body["token"], str)
    assert len(body["token"]) >= 32
    assert body["expires_in"] == main.ADMIN_TOKEN_TTL_SECONDS
    assert response.headers["cache-control"] == "no-store"


def test_expired_admin_token_cannot_write(client: TestClient) -> None:
    main.ACTIVE_ADMIN_TOKENS["expired-token"] = time.time() - 1

    response = client.post(
        "/datasets",
        json=dataset_payload(),
        headers={"X-Admin-Token": "expired-token"},
    )

    assert response.status_code == 401
    assert "expired-token" not in main.ACTIVE_ADMIN_TOKENS


@pytest.mark.parametrize("malicious_url", ["javascript:alert(1)", "data:text/html,test", "ftp://example.org/data"])
def test_non_http_source_urls_are_rejected(client: TestClient, malicious_url: str) -> None:
    response = client.post(
        "/datasets",
        json=dataset_payload(malicious_url),
        headers={"X-Admin-Token": admin_token(client)},
    )

    assert response.status_code == 422
    assert "valid HTTP or HTTPS URL" in response.text


def test_valid_https_source_url_is_accepted(client: TestClient) -> None:
    response = client.post(
        "/datasets",
        json=dataset_payload("https://physionet.org/content/mitdb/1.0.0/"),
        headers={"X-Admin-Token": admin_token(client)},
    )

    assert response.status_code == 201
    assert response.json()["source_url"] == "https://physionet.org/content/mitdb/1.0.0/"


def test_failed_logins_are_rate_limited(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(main, "LOGIN_MAX_FAILURES", 2)

    for _ in range(2):
        response = client.post("/admin/login", json={"password": "incorrect"})
        assert response.status_code == 401

    response = client.post("/admin/login", json={"password": "test-only-admin-password"})

    assert response.status_code == 429
    assert int(response.headers["retry-after"]) > 0
