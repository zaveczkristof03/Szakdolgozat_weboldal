"""EKG MetaData Explorer backend.

Magyar áttekintés: a backend egy kis FastAPI alkalmazás, amely az EKG-adatbázisok
metaadatait egy SQLite fájlból szolgálja ki REST API-n keresztül.

Modulok:
- ``config``   – beállítások (adatbázisfájl helye, admin jelszó, CORS).
- ``fields``   – a katalógus mezőinek EGYETLEN közös listája.
- ``db``       – kapcsolat az SQLite-hoz és a séma (táblák, migrációk).
- ``schemas``  – a bejövő/kimenő adatok ellenőrzése (Pydantic modellek).
- ``security`` – admin bejelentkezés, tokenek, próbálkozás-korlátozás.
- ``routers``  – az API végpontjai (``/datasets``, ``/admin``).
- ``main``     – mindezt összeköti egy FastAPI alkalmazássá.
"""
