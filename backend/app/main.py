"""A FastAPI alkalmazás összeállítása.

Indításkor (``lifespan``) egyszer lefut az adatbázis-inicializálás és a
migrációk, utána a routerek kiszolgálják a kéréseket.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import config, db, security  # noqa: F401  (security import: jelszó-ellenőrzés indításkor)
from .routers import admin, datasets


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    db.initialize_database()
    yield


app = FastAPI(
    title="EKG MetaData Explorer API",
    description="Read-only catalog API for ECG dataset metadata, with admin-protected editing.",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-Admin-Token"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(datasets.router)
app.include_router(admin.router)
