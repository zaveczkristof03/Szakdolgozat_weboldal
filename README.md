# EKG MetaData Explorer

React/Vite frontend and FastAPI/SQLite backend for comparing officially documented ECG datasets.

## Main research features

- Full-text metadata search and structured catalog filters.
- Research Fit Finder with transparent, rule-based requirements (no opaque ranking).
- Four-dataset comparison with difference and missing-metadata controls.
- Metadata completeness audit and FAIR-related evidence overview (not a certification).
- Browser-local research collections, notes and CSV exports.

See [`HASZNALATI_UTMUTATO_HU.md`](HASZNALATI_UTMUTATO_HU.md) for the Hungarian user guide, field definitions, calculation rules and Windows startup instructions.

## Run locally

1. Create or activate `backend/.venv`, then install the backend packages used by the project and its tests:

   ```powershell
   cd backend
   py -m venv .venv
   .\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
   ```

2. Set a non-empty administrator secret for the current shell. The backend intentionally refuses to start without it.

   ```powershell
   $env:EKG_ADMIN_PASSWORD = "use-a-strong-local-secret"
   .\.venv\Scripts\uvicorn.exe main:app --reload
   ```

3. In a second terminal, start the frontend:

   ```powershell
   cd frontend
   npm.cmd install
   npm.cmd run dev
   ```

`VITE_API_BASE_URL` optionally changes the frontend API base URL; it defaults to `http://127.0.0.1:8000` for local development.

## Catalog data and migration

`ecg_dataset_catalog` is the active catalog table. All 21 curated records are version-controlled in `backend/data/catalog.json`; the SQLite file itself is git-ignored. Rebuild or refresh the database from the JSON (a timestamped backup is created first, and nothing is deleted):

```powershell
cd backend
.\.venv\Scripts\python.exe scripts\catalog_sync.py import   # JSON -> database
.\.venv\Scripts\python.exe scripts\catalog_sync.py export   # database -> JSON
```

Schema changes are numbered migrations in `backend/app/db.py`. Migration 2 makes `records`, `frequency` and `leads` nullable so unknown values stay unknown (previously they defaulted to 0 / 250 / 2); it backs up the database before rebuilding the table. The historical `ecgdatabase` table is retained unchanged.

## API

- `GET /health`
- `GET /datasets` — compatibility list endpoint
- `GET /datasets/search` — validated server-side `q`, category, frequency, lead-count, format, licence, access-condition, sorting and pagination parameters
- `GET /datasets/{id}` — detail record
- `records`, `frequency`, `leads` and `subject_count` may be `null` (not recorded)
- `POST`, `PUT`, `DELETE /datasets` — require `X-Admin-Token`
- `POST /admin/login`, `POST /admin/logout`

External source URLs are limited to HTTP(S). The frontend opens external resources with `noopener noreferrer`. A LightWAVE link is shown only when the verified `lightwave_database_id` is present.

## Checks

```powershell
cd backend
$env:EKG_ADMIN_PASSWORD = "test-only-admin-password"
.\.venv\Scripts\python.exe -m pytest tests -q

cd ..\frontend
npm.cmd run test:domain
npm.cmd run lint
npm.cmd run build
```

## Project structure

See [`docs/ARCHITEKTURA_HU.md`](docs/ARCHITEKTURA_HU.md) (Hungarian) for a beginner-friendly map of every module, and [`docs/VALTOZASOK_2026-11-25.md`](docs/VALTOZASOK_2026-11-25.md) for the latest changes and check results.

## Known limitations

The admin token and login-rate-limit state are in process memory, appropriate for a single local backend process but not a multi-worker deployment. Research collections are stored in browser `localStorage` only.
