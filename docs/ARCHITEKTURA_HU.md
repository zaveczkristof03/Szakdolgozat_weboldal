# Hogyan épül fel az EKG MetaData Explorer? – magyarázat kezdőknek

Ez a leírás azt magyarázza el, melyik fájl mit csinál, és hogyan jut el egy
adat az adatbázistól a képernyőig. A védésen is ezt a sorrendet érdemes követni.

## A nagy kép

```
SQLite fájl  →  FastAPI backend  →  REST API (JSON)  →  React frontend  →  böngésző
(ekg_metadata.db)  (backend/app/)     (/datasets)        (frontend/src/)
```

1. Az adatok egy SQLite fájlban vannak (`backend/ekg_metadata.db`), egyetlen
   táblában: `ecg_dataset_catalog`. Egy sor = egy EKG-adatbázis metaadatai.
2. A backend (Python, FastAPI) ezt a táblát olvassa, és JSON-ként adja ki a
   `GET /datasets` címen.
3. A frontend (React, TypeScript) induláskor egyszer letölti a teljes listát, és
   onnantól minden szűrést, összehasonlítást, számítást a böngésző végez.
4. Írni (új rekord, szerkesztés, törlés) csak admin bejelentkezés után lehet.

## Backend – `backend/`

| Fájl | Mit csinál? |
|---|---|
| `main.py` | Csak belépési pont, hogy a `uvicorn main:app` parancs működjön. |
| `app/config.py` | Beállítások: hol van az adatbázis, kötelező admin jelszó, CORS. |
| `app/fields.py` | A katalógus mezőinek **egyetlen** listája. Minden SQL ebből épül, így nem lehet egy mezőt „elfelejteni”. |
| `app/db.py` | Kapcsolat az SQLite-hoz (a végén mindig lezárja), táblák létrehozása, **migrációk** (számozott sémaváltozások, mindegyik előtt automatikus mentés). |
| `app/schemas.py` | Bejövő adatok ellenőrzése: DOI-formátum, dátum, nem negatív számok, csak http(s) link. A hiányzó szám `null` marad. |
| `app/security.py` | Admin token kiadása és ellenőrzése, próbálkozás-korlátozás. |
| `app/routers/datasets.py` | A `/datasets` végpontok (lista, keresés, adatlap, létrehozás, szerkesztés, törlés). |
| `app/routers/admin.py` | `/admin/login`, `/admin/logout`. |
| `data/catalog.json` | A 21 ellenőrzött rekord. Ez a verziókezelt „igazság forrása”. |
| `scripts/catalog_sync.py` | JSON → adatbázis (`import`) és adatbázis → JSON (`export`). |
| `tests/` | 30 automatikus teszt, mindegyik ideiglenes adatbázison. |

### Az API (nem változott, a régi kliensek is működnek)

| Végpont | Ki hívhatja? | Mit ad? |
|---|---|---|
| `GET /health` | bárki | `{"status":"ok"}` |
| `GET /datasets` | bárki | a teljes katalógus |
| `GET /datasets/search` | bárki | szerveroldali keresés lapozással |
| `GET /datasets/{id}` | bárki | egy rekord |
| `POST /datasets` | admin | új rekord |
| `PUT /datasets/{id}` | admin | rekord teljes cseréje |
| `DELETE /datasets/{id}` | admin | törlés |
| `POST /admin/login`, `/admin/logout` | – | token kiadása / visszavonása |

Az egyetlen változás: a `records`, `frequency` és `leads` mező lehet `null`
(ismeretlen). Korábban ezek kötelezőek voltak, és az adatbázis 0 / 250 / 2
alapértéket adott nekik – ez ellentmondott a „ne találj ki adatot” szabálynak.

## Frontend – `frontend/src/`

| Mappa / fájl | Mit csinál? |
|---|---|
| `main.tsx` | Elindítja a React alkalmazást, betölti a stílusokat. |
| `App.tsx` | A „karmester”: letölti a katalógust, tárolja a közös állapotot (összehasonlítás, gyűjtemények, admin token), és az URL alapján kiválasztja az oldalt. |
| `api/client.ts` | Minden backend-hívás egy helyen. |
| `hooks/useHashRoute.ts` | Navigáció a címsor `#/...` része alapján (Vissza gomb, linkelhető adatlap). |
| `domain/` | **A szabályok és számítások**, React nélkül, ezért önállóan tesztelhetők. |
| `features/` | Oldalanként egy mappa: a képernyők. |
| `components/` | Közös építőelemek: `Modal` (felugró ablak), `Value` (hiányzó érték jelölése), `EmptyState`. |
| `layout/` | Oldalsáv és felső sáv. |
| `styles/` | Stíluslapok témánként (alap, elrendezés, katalógus, összehasonlítás, …). |
| `assets/fonts/` | Helyben tárolt betűtípusok (internet nélkül is működik). |

### A `domain/` mappa részletesen

| Fájl | Mit csinál? |
|---|---|
| `types.ts` | Az adatbázis-rekord TypeScript-típusa. |
| `format.ts` | Számformázás, „Not recorded”, biztonságos linkek. |
| `matching.ts` | Kutatási terület és annotációtípus felismerése kifejezések alapján, **indoklással** (melyik mezőben, milyen értékkel). |
| `search.ts` | A katalógus szabad szöveges keresése és szűrői. |
| `finder.ts` | Research Fit Finder: minden feltételre „teljesül / nem teljesül / nem ellenőrizhető”. |
| `completeness.ts` | 16 mező kitöltöttsége. |
| `fair.ts` | FAIR dokumentációs ellenőrzőlista (x / y, nem pontszám). |
| `compare.ts` | Az összehasonlító tábla sorai, eltérések, kulcsfontosságú eltérések. |
| `csv.ts` | Biztonságos CSV-export. |
| `collections.ts` | My Research gyűjtemények mentése a böngészőbe. |
| `datasetForm.ts` | Az admin űrlap ellenőrzése és átalakítása API-kéréssé. |

## Egy kattintás útja – példa a védésre

„A felhasználó a Research Fit Finderben kiválasztja: *Atrial fibrillation*, legalább 250 Hz.”

1. `features/finder/ResearchFinder.tsx` eltárolja a két feltételt.
2. Meghívja a `domain/finder.ts` → `findResearchMatches` függvényt a teljes katalógussal.
3. Ez minden adatbázisra megnézi:
   - `matching.ts`: szerepel-e az „atrial fibrillation” a klinikai fókuszban, az annotációban vagy a névben → ha igen, az indoklás: *„documented in the clinical focus: Atrial fibrillation”*;
   - a frekvencia ≥ 250 Hz? Ha a frekvencia nincs rögzítve, az **nem** számít teljesítettnek.
4. A találatok mellett megjelenik az indoklás, a kizártak mellett az ok.
5. Nincs pontszám és nincs rangsor – ezt tudatosan választottuk, mert egy pontszám olyan pontosságot sugallna, amit a metaadatok nem támasztanak alá.

## Tesztek

- Backend: `pytest` – 30 teszt (API, biztonság, migráció, a `catalog.json` adatminősége).
- Frontend: `npm run test:domain` – 17 teszt a `domain/` szabályaira.
- Ezen felül: TypeScript-ellenőrzés (`tsc`), lint (`oxlint`), production build.
