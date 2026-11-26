"""Valódi EKG-jelrészletek letöltése a PhysioNetről az adatlapokhoz.

Mit csinál?
- A ``data/catalog.json`` minden adatbázisánál megnyitja a forrás egyik felvételét
  (alapból a RECORDS lista első elemét), és kivág belőle 3 másodpercet.
- Az eredményt a ``data/ecg_samples.json`` fájlba írja: felvétel neve, a felvétel
  összes jelének neve (ebből rajzolódik az elvezetéstérkép), a kirajzolt jel neve,
  mértékegysége, mintavételezése, a kivágás kezdete és a mintaértékek mV-ban.

Miért kell? Az adatlapon így egy valódi, forrásból származó jelrészlet látszik,
nem illusztráció. Ha egy adatbázisnál a letöltés nem sikerül, vagy nincs
egyértelműen EKG-nak nevezett jel, akkor az adatbázis kimarad a fájlból, és
az oldal ott nem rajzol semmit. Becsült vagy kitalált jelet SOHA nem írunk be.

A jelet a ``wfdb`` csomag olvassa (a PhysioNet hivatalos Python-könyvtára),
ez kezeli az összes WFDB-formátumot és a fizikai mértékegységre váltást.

Futtatás a backend mappából (internet kell hozzá):
    .\\.venv\\Scripts\\python.exe -m pip install wfdb
    .\\.venv\\Scripts\\python.exe scripts\\fetch_ecg_samples.py
"""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path
from typing import Any

BACKEND_DIR = Path(__file__).resolve().parents[1]
CATALOG_PATH = BACKEND_DIR / "data" / "catalog.json"
OUTPUT_PATH = BACKEND_DIR / "data" / "ecg_samples.json"

DURATION_S = 3.0
# A felvétel elején gyakran van beállási zaj, ezért ha elég hosszú, 10 s-tól vágunk.
PREFERRED_START_S = 10.0

# Ahol a RECORDS lista első eleme nem a katalógusban leírt változat, ott itt
# rögzítjük, melyik felvételt használjuk. Minden kivétel indokolt:
# - PTB-XL: a lista a 100 Hz-es lekicsinyített változattal kezdődik, a katalógus
#   az eredeti 500 Hz-es felvételeket írja le.
RECORD_OVERRIDES: dict[str, str] = {
    "ptb-xl/1.0.3": "records500/00000/00001_hr",
}
# Legfeljebb ennyi felvételt próbálunk végig, ha az elsőnek nincs jelfájlja
# (pl. az AFDB két felvételéhez csak fejléc tartozik).
MAX_CANDIDATES = 5

# A kirajzolandó jel választási sorrendje: először a II. elvezetés valamelyik
# változata (a klinikai „ritmuscsík” ez szokott lenni), utána bármely ismert
# elvezetés, végül az „ECG” szót tartalmazó név. Más jelet (légzés, vérnyomás)
# soha nem rajzolunk ki.
PREFERRED_SIGNALS = ("II", "MLII", "ML2")
KNOWN_LEADS = {
    "I", "II", "III", "AVR", "AVL", "AVF",
    "MLI", "MLII", "MLIII", "ML2", "ML3",
    "V1", "V2", "V3", "V4", "V5", "V6",
    "MV1", "MV2", "MV3", "MV4", "MV5", "MV6",
}
UNIT_TO_MV = {"mv": 1.0, "uv": 0.001, "µv": 0.001, "μv": 0.001, "v": 1000.0}


def normalize(name: str) -> str:
    return name.strip().upper().replace(" ", "").replace("-", "")


def choose_signal(names: list[str], units: list[str]) -> int | None:
    usable = [index for index, unit in enumerate(units) if (unit or "").strip().lower() in UNIT_TO_MV]
    for wanted in PREFERRED_SIGNALS:
        for index in usable:
            if normalize(names[index]) == wanted:
                return index
    for index in usable:
        if normalize(names[index]) in KNOWN_LEADS:
            return index
    for index in usable:
        if "ECG" in normalize(names[index]):
            return index
    return None


def split_record_path(database: str, record: str) -> tuple[str, str]:
    """``records500/00000/00001_hr`` → (``ptb-xl/1.0.3/records500/00000``, ``00001_hr``)."""
    if "/" in record:
        folder, name = record.rsplit("/", 1)
        return f"{database}/{folder}", name
    return database, record


def candidate_records(wfdb: Any, database: str, prefix: str = "", depth: int = 0) -> list[str]:
    """Az első néhány felvétel útvonala. Ha a RECORDS lista mappákat sorol fel
    (pl. ``WFDBRecords/01/010/``), abba belelépünk, és ott keressük a felvételeket."""
    found: list[str] = []
    location = f"{database}/{prefix.rstrip('/')}" if prefix else database
    for entry in wfdb.get_record_list(location):
        path = f"{prefix}{entry}"
        if entry.endswith("/"):
            if depth < 3:
                found.extend(candidate_records(wfdb, database, path, depth + 1))
        elif entry:
            found.append(path)
        if len(found) >= MAX_CANDIDATES:
            break
    return found[:MAX_CANDIDATES]


def fetch_sample(wfdb: Any, database: str) -> dict[str, Any]:
    override = RECORD_OVERRIDES.get(database)
    candidates = [override] if override else candidate_records(wfdb, database)
    header = None
    for record in candidates:
        pn_dir, record_name = split_record_path(database, record)
        header = wfdb.rdheader(record_name, pn_dir=pn_dir)
        if header.sig_name:  # van jelfájl is, nem csak fejléc
            break
    if header is None or not header.sig_name:
        raise ValueError("az első felvételekhez nem tartozik jel")

    names = list(header.sig_name)
    units = list(header.units or [""] * len(names))
    index = choose_signal(names, units)
    if index is None:
        raise ValueError(f"nincs egyértelműen EKG-nak nevezett jel ({', '.join(names)})")

    fs = float(header.fs)
    length = int(header.sig_len or 0)
    needed = int(round(DURATION_S * fs))
    start = int(PREFERRED_START_S * fs) if length >= int((PREFERRED_START_S + DURATION_S) * fs) else 0
    if length and start + needed > length:
        raise ValueError("a felvétel rövidebb 3 másodpercnél")

    signal = wfdb.rdrecord(record_name, pn_dir=pn_dir, sampfrom=start, sampto=start + needed, channels=[index])
    factor = UNIT_TO_MV[units[index].strip().lower()]
    values: list[float | None] = []
    for row in signal.p_signal:
        value = float(row[0])
        # A WFDB a hiányzó mintát NaN-ként adja vissza: ezt hiányként tartjuk meg.
        values.append(None if value != value else round(value * factor, 4))

    return {
        "record": record,
        "record_url": f"https://physionet.org/lightwave/?db={database}&record={record}",
        "signal_names": names,
        "signal": names[index],
        "units": "mV",
        "fs": fs,
        "start_s": round(start / fs, 3),
        "duration_s": DURATION_S,
        "values": values,
    }


def main() -> int:
    try:
        import wfdb  # type: ignore[import-not-found]
    except ImportError:
        print("A wfdb csomag hiányzik. Telepítés: python -m pip install wfdb")
        return 1

    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    samples: dict[str, Any] = {}
    skipped: dict[str, str] = {}
    for dataset in catalog:
        database = dataset.get("source_database_id")
        if not database:
            continue
        try:
            samples[database] = fetch_sample(wfdb, database)
            sample = samples[database]
            print(f"OK    {database}: {sample['record']} / {sample['signal']} ({sample['fs']:g} Hz)")
        except Exception as error:  # noqa: BLE001 – minden hibát kihagyásként rögzítünk
            skipped[database] = str(error) or type(error).__name__
            print(f"KIMAR {database}: {skipped[database]}")

    payload = {
        "generated": date.today().isoformat(),
        "source": "PhysioNet, a wfdb Python-csomaggal letöltve",
        "duration_s": DURATION_S,
        "samples": samples,
        "skipped": skipped,
    }
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"\n{len(samples)} jelrészlet mentve ide: {OUTPUT_PATH}; {len(skipped)} kimaradt.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
