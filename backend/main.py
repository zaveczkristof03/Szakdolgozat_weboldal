"""Belépési pont: ``uvicorn main:app --reload``.

A tényleges kód az ``app/`` mappában van; ez a fájl csak azért maradt itt,
hogy a megszokott indítási parancs (és az INDITAS_EGYSZERU.bat) változatlanul működjön.
"""

from app.main import app

__all__ = ["app"]
