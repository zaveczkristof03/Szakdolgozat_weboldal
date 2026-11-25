# EKG MetaData Explorer

A small web application for finding and comparing open ECG datasets by their documented metadata.
React/Vite frontend, read-only FastAPI/SQLite backend. Thesis project.

## What it does

- **Catalog**: search and filter 21 PhysioNet ECG datasets, sort the table, export CSV.
- **Dataset page**: every recorded field, links to PhysioNet and LightWAVE, and how well the dataset is documented.
- **Compare**: up to four datasets side by side, with key differences marked.
- **Methodology**: where the data comes from, how “Documented” is counted, the FAIR-related checks and the limitations.

The interface is available in Hungarian (default) and English via the HU / EN switch in the header.

Missing values are shown as “Not recorded” (“Nincs adat”) and are never replaced by estimates. Records and subjects are always kept separate.

See [`HASZNALATI_UTMUTATO_HU.md`](HASZNALATI_UTMUTATO_HU.md) for the Hungarian user guide and [`docs/ARCHITEKTURA_HU.md`](docs/ARCHITEKTURA_HU.md) for a beginner-friendly map of the code.

## Run locally (Windows)

Double-click `INDITAS_EGYSZERU.bat`, or start the two parts by hand:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

The site runs at `http://localhost:5173`, the API at `http://127.0.0.1:8000` (`/docs` for the API documentation).
`VITE_API_BASE_URL` optionally changes the API address used by the frontend.

## Catalog data

All 21 curated records are version-controlled in `backend/data/catalog.json`; the SQLite file is git-ignored.
To change the data, edit the JSON and import it (a timestamped backup is made first, nothing is deleted):

```powershell
cd backend
.\.venv\Scripts\python.exe scripts\catalog_sync.py import   # JSON -> database
.\.venv\Scripts\python.exe scripts\catalog_sync.py export   # database -> JSON
```

Every record is validated on import (DOI format, ISO dates, HTTP(S) links, non-negative counts).
Schema changes are numbered migrations in `backend/app/db.py`, each preceded by an automatic backup.

## API (read-only)

- `GET /health`
- `GET /datasets`: the full catalog
- `GET /datasets/search`: server-side search, filters, sorting and pagination
- `GET /datasets/{id}`: one record

`records`, `frequency`, `leads` and `subject_count` may be `null` (not recorded).

## Checks

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest tests -q

cd ..\frontend
npm.cmd run test:domain
npm.cmd run lint
npm.cmd run build
```
