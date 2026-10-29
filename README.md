# EKG MetaData Explorer

React/Vite frontend and FastAPI/SQLite backend for comparing officially documented ECG datasets.

## Run locally

1. Create or activate `backend/.venv`, then install the backend packages used by the project and its tests:

   ```powershell
   cd backend
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
   npm install
   npm run dev
   ```

`VITE_API_BASE_URL` optionally changes the frontend API base URL; it defaults to `http://127.0.0.1:8000` for local development.

## Catalog data and migration

`ecg_dataset_catalog` is the active catalog used by the API. The historical `ecgdatabase` table is retained unchanged for a later, explicit consolidation migration.

The 2026-10-29 catalog expansion added optional provenance, identifier, format, access, annotation, duration and LightWAVE fields with additive SQLite `ALTER TABLE` operations. A byte-identical pre-migration database backup is stored in `backend/backups/`.

The curated additions are in `backend/catalog_seed.json`. Run the idempotent importer with the administrator environment variable configured:

```powershell
cd backend
.\.venv\Scripts\python.exe seed_catalog.py
```

The importer skips a record when either its official database ID or its normalized official source URL already exists. Seed metadata is limited to facts recorded in the linked official source; fields not verified are left empty.

## API

- `GET /health`
- `GET /datasets` — compatibility list endpoint
- `GET /datasets/search` — validated server-side `q`, category, frequency, lead-count, format, licence, access-condition, sorting and pagination parameters
- `GET /datasets/{id}` — detail record
- `POST`, `PUT`, `DELETE /datasets` — require `X-Admin-Token`
- `POST /admin/login`, `POST /admin/logout`

External source URLs are limited to HTTP(S). The frontend opens external resources with `noopener noreferrer`. A LightWAVE link is shown only when the verified `lightwave_database_id` is present.

## Checks

```powershell
cd backend
$env:EKG_ADMIN_PASSWORD = "test-only-admin-password"
.\.venv\Scripts\python.exe -m pytest tests -q

cd ..\frontend
npm run lint
npm run build
```

## Known limitations

The current token and login-rate-limit state are in process memory, appropriate for a single local backend process but not a multi-worker deployment. The legacy SQLModel table remains for data-preservation reasons and is not used by the running API.
