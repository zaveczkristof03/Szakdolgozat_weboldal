"""Admin hozzáférés és külső linkek biztonsági tesztjei."""

from __future__ import annotations

import os
import subprocess
import sys
import time

import pytest

from app import config, security
from conftest import ADMIN_PASSWORD, BACKEND_DIRECTORY, login


def dataset_payload(source_url: str = "https://example.org/datasets/test") -> dict[str, object]:
    return {"name": "Security test dataset", "records": 1, "frequency": 250, "leads": 1,
            "category": "Test", "source_url": source_url, "description": "Temporary test record."}


def test_backend_refuses_to_import_without_admin_password() -> None:
    environment = os.environ.copy()
    environment.pop("EKG_ADMIN_PASSWORD", None)
    script = f"import sys; sys.path.insert(0, {str(BACKEND_DIRECTORY)!r}); import main"
    result = subprocess.run([sys.executable, "-c", script], env=environment, capture_output=True, text=True, check=False)
    assert result.returncode != 0
    assert "EKG_ADMIN_PASSWORD must be configured" in result.stderr


def test_catalog_writes_require_an_admin_token(empty_client) -> None:
    response = empty_client.post("/datasets", json=dataset_payload())
    assert response.status_code == 401
    assert response.json()["detail"] == "Admin login is required for catalog changes."


def test_successful_login_issues_a_non_cacheable_token(empty_client) -> None:
    response = empty_client.post("/admin/login", json={"password": ADMIN_PASSWORD})
    assert response.status_code == 200
    assert len(response.json()["token"]) >= 32
    assert response.json()["expires_in"] == config.ADMIN_TOKEN_TTL_SECONDS
    assert response.headers["cache-control"] == "no-store"


def test_logout_invalidates_the_token(empty_client) -> None:
    headers = login(empty_client)
    assert empty_client.post("/admin/logout", headers=headers).status_code == 204
    assert empty_client.post("/datasets", json=dataset_payload(), headers=headers).status_code == 401


def test_expired_admin_token_cannot_write(empty_client) -> None:
    security.ACTIVE_ADMIN_TOKENS["expired-token"] = time.time() - 1
    response = empty_client.post("/datasets", json=dataset_payload(), headers={"X-Admin-Token": "expired-token"})
    assert response.status_code == 401
    assert "expired-token" not in security.ACTIVE_ADMIN_TOKENS


@pytest.mark.parametrize("malicious_url", ["javascript:alert(1)", "data:text/html,test", "ftp://example.org/data"])
def test_non_http_source_urls_are_rejected(empty_client, malicious_url: str) -> None:
    response = empty_client.post("/datasets", json=dataset_payload(malicious_url), headers=login(empty_client))
    assert response.status_code == 422
    assert "valid HTTP or HTTPS URL" in response.text


def test_valid_https_source_url_is_accepted(empty_client) -> None:
    response = empty_client.post("/datasets", json=dataset_payload("https://physionet.org/content/mitdb/1.0.0/"), headers=login(empty_client))
    assert response.status_code == 201
    assert response.json()["source_url"] == "https://physionet.org/content/mitdb/1.0.0/"


def test_failed_logins_are_rate_limited(empty_client, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(security, "LOGIN_MAX_FAILURES", 2)
    for _ in range(2):
        assert empty_client.post("/admin/login", json={"password": "incorrect"}).status_code == 401
    response = empty_client.post("/admin/login", json={"password": ADMIN_PASSWORD})
    assert response.status_code == 429
    assert int(response.headers["retry-after"]) > 0
