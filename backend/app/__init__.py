"""EKG MetaData Explorer backend.

Magyar áttekintés: a backend egy kis FastAPI alkalmazás, amely az EKG-adatbázisok
metaadatait egy SQLite fájlból szolgálja ki REST API-n keresztül.

Modulok:
- ``config``   – beállítások (adatbázisfájl helye, CORS).
- ``fields``   – a katalógus mezőinek EGYETLEN közös listája.
- ``db``       – kapcsolat az SQLite-hoz és a séma (táblák, migrációk).
- ``schemas``  – a bejövő/kimenő adatok ellenőrzése (Pydantic modellek).
- ``routers``  – az API végpontjai (``/datasets``, csak olvasás).
- ``main``     – mindezt összeköti egy FastAPI alkalmazássá.
"""
