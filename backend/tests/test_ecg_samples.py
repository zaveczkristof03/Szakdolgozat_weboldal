"""A jelrészlet-végpont és a letöltő szkript tesztjei.

A szkriptet hálózat nélkül teszteljük: egy helyben megírt WFDB-felvételt olvas,
a PhysioNet-hívásokat pedig erre a mappára irányítjuk. A teszt jel csak a
kivágás és a jelválasztás logikáját ellenőrzi, az oldalra soha nem kerül ki.
"""

from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from app import config
from scripts import fetch_ecg_samples as fetcher


def test_ecg_sample_missing_file_gives_404(catalog_client, monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setattr(config, "ECG_SAMPLES_PATH", tmp_path / "nincs.json")
    assert catalog_client.get("/datasets/1/ecg-sample").status_code == 404


def test_ecg_sample_is_served_by_source_id(catalog_client, monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    dataset = catalog_client.get("/datasets/1").json()
    path = tmp_path / "ecg_samples.json"
    path.write_text(json.dumps({"samples": {dataset["source_database_id"]: {"record": "r1", "values": [0.1, None]}}}), encoding="utf-8")
    monkeypatch.setattr(config, "ECG_SAMPLES_PATH", path)

    body = catalog_client.get("/datasets/1/ecg-sample").json()
    assert body["record"] == "r1"
    assert body["values"] == [0.1, None]
    assert catalog_client.get("/datasets/2/ecg-sample").status_code == 404
    assert catalog_client.get("/datasets/9999/ecg-sample").status_code == 404


@pytest.mark.parametrize(
    ("names", "units", "expected"),
    [
        (["MLII", "V5"], ["mV", "mV"], 0),
        (["V1", "MLII"], ["mV", "mV"], 1),
        (["RESP", "ECG", "BP"], ["mV", "mV", "mmHg"], 1),
        (["RESP", "BP"], ["mV", "mmHg"], None),
        (["II"], ["mmHg"], None),
        (["I", "II", "III"], ["mV", "mV", "mV"], 1),
    ],
)
def test_choose_signal_only_picks_ecg(names, units, expected) -> None:
    assert fetcher.choose_signal(names, units) == expected


def test_fetch_sample_cuts_three_seconds_in_mv(tmp_path: Path) -> None:
    wfdb = pytest.importorskip("wfdb")
    import numpy as np

    fs = 100
    seconds = 20
    signal = np.column_stack([np.linspace(0, 1, fs * seconds), np.zeros(fs * seconds)])
    wfdb.wrsamp("rec1", fs=fs, units=["uV", "mV"], sig_name=["V1", "RESP"], p_signal=signal * [1000, 1], fmt=["16", "16"], write_dir=str(tmp_path))

    local = SimpleNamespace(
        get_record_list=lambda database: ["rec1"],
        rdheader=lambda name, pn_dir: wfdb.rdheader(str(tmp_path / name)),
        rdrecord=lambda name, pn_dir, **kwargs: wfdb.rdrecord(str(tmp_path / name), **kwargs),
    )
    sample = fetcher.fetch_sample(local, "teszt/1.0.0")

    assert sample["signal"] == "V1"
    assert sample["signal_names"] == ["V1", "RESP"]
    assert sample["start_s"] == 10.0
    assert len(sample["values"]) == 3 * fs
    # µV-ból mV-ra váltva a lineáris rámpa 10 s-nál kb. 0,5 mV.
    assert sample["values"][0] == pytest.approx(10 * fs / (fs * seconds - 1), abs=0.002)


def test_candidate_records_descends_into_folders_and_skips_header_only() -> None:
    listing = {
        "db/1.0.0": ["WFDBRecords/01/"],
        "db/1.0.0/WFDBRecords/01": ["010/"],
        "db/1.0.0/WFDBRecords/01/010": ["JS00001", "JS00002"],
    }
    fake = SimpleNamespace(get_record_list=lambda location: listing[location])
    assert fetcher.candidate_records(fake, "db/1.0.0") == ["WFDBRecords/01/010/JS00001", "WFDBRecords/01/010/JS00002"]

    headers = {"a": SimpleNamespace(sig_name=None, units=None), "b": SimpleNamespace(sig_name=["ECG"], units=["mV"], fs=10, sig_len=0)}
    calls: list[str] = []
    header_only = SimpleNamespace(
        get_record_list=lambda location: ["a", "b"],
        rdheader=lambda name, pn_dir: calls.append(name) or headers[name],
        rdrecord=lambda name, pn_dir, **kwargs: SimpleNamespace(p_signal=[[0.1]] * 30),
    )
    sample = fetcher.fetch_sample(header_only, "db/1.0.0")
    assert calls == ["a", "b"]
    assert sample["record"] == "b"
