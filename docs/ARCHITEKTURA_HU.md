# Hogyan épül fel az EKG MetaData Explorer? – magyarázat kezdőknek

Ez a leírás azt magyarázza el, melyik fájl mit csinál, és hogyan jut el egy
adat a forrásfájltól a képernyőig. A védésen is ezt a sorrendet érdemes követni.

## A nagy kép

```
catalog.json  →  SQLite fájl  →  FastAPI backend  →  REST API (JSON)  →  React frontend  →  böngésző
(ellenőrzött     (ekg_metadata.db)  (backend/app/)     (GET /datasets)     (frontend/src/)
 adatok)
```

1. A 21 adatbázis ellenőrzött metaadatai a `backend/data/catalog.json` fájlban
   vannak. Ez van verziókezelve, ez az „igazság forrása”.
2. A `catalog_sync.py import` parancs ezt betölti egy SQLite adatbázisba
   (`backend/ekg_metadata.db`, tábla: `ecg_dataset_catalog`). Betöltés előtt
   minden rekordot ellenőriz (DOI-formátum, dátum, link, nem negatív számok).
3. A backend (Python, FastAPI) ezt a táblát olvassa, és JSON-ként adja ki.
   **Az API csak olvasható**: nincs bejelentkezés, nincs írás a weben keresztül.
4. A frontend (React, TypeScript) induláskor egyszer letölti a teljes listát, és
   onnantól minden szűrést, rendezést, összehasonlítást a böngésző végez.

**Miért nincs admin felület?** Az adatok ritkán változnak, és minden változást
forrással kell igazolni. Ezt a legtisztábban a verziókezelt JSON-fájl
szerkesztése adja: minden módosítás visszakövethető a git-történetben. Így a
webes felületen nincs jelszó és nincs írási végpont, tehát nincs mit feltörni.

## Backend – `backend/`

| Fájl | Mit csinál? |
|---|---|
| `main.py` | Csak belépési pont, hogy a `uvicorn main:app` parancs működjön. |
| `app/config.py` | Beállítások: hol van az adatbázis és a JSON, CORS. |
| `app/fields.py` | A katalógus mezőinek **egyetlen** listája. Minden SQL ebből épül, így nem lehet egy mezőt „elfelejteni”. |
| `app/db.py` | Kapcsolat az SQLite-hoz (a végén mindig lezárja), táblák létrehozása, **migrációk** (számozott sémaváltozások, mindegyik előtt automatikus mentés). |
| `app/schemas.py` | Adatellenőrzés (Pydantic): DOI-formátum, dátum, nem negatív számok, csak http(s) link. A hiányzó szám `null` marad. |
| `app/routers/datasets.py` | A `/datasets` végpontok: lista, keresés, egy rekord. |
| `data/catalog.json` | A 21 ellenőrzött rekord. |
| `scripts/catalog_sync.py` | JSON → adatbázis (`import`) és adatbázis → JSON (`export`). |
| `tests/` | Automatikus tesztek, mindegyik ideiglenes adatbázison. |

### Az API

| Végpont | Mit ad? |
|---|---|
| `GET /health` | `{"status":"ok"}` |
| `GET /datasets` | a teljes katalógus |
| `GET /datasets/search` | szerveroldali keresés, szűrés, rendezés, lapozás |
| `GET /datasets/{id}` | egy rekord |

## Frontend – `frontend/src/`

| Mappa / fájl | Mit csinál? |
|---|---|
| `main.tsx` | Elindítja a React alkalmazást, betölti a stílusokat. |
| `App.tsx` | A „karmester”: letölti a katalógust, tárolja az összehasonlításra kijelölt adatbázisokat, és az URL alapján kiválasztja az oldalt. |
| `api/client.ts` | A backend-hívás egy helyen. |
| `hooks/useMediaQuery.ts` | Figyeli az ablak szélességét: széles képernyőn az adatlap állandó jobb oldali panel, keskenyen felugró ablak. |
| `hooks/useTheme.ts` | Világos / sötét mód: először a rendszerbeállítást követi, utána a választást megjegyzi. |
| `hooks/useHashRoute.ts` | Navigáció a címsor `#/...` része alapján (Vissza gomb, linkelhető adatlap: `#/catalog?dataset=12`). |
| `layout/Header.tsx` | Felső sáv a három menüponttal és a HU / EN nyelvváltóval. |
| `i18n/` | Kétnyelvűség: `lang.ts` (nyelvek, mentés a böngészőbe), `useLang.ts` (a `t()` függvény), `strings.ts` (a felület összes felirata magyarul és angolul). |
| `domain/` | **A szabályok és számítások**, React nélkül, ezért önállóan tesztelhetők. |
| `features/` | Oldalanként egy mappa: `catalog`, `chooser` (Melyiket válasszam?), `dataset` (adatlap), `compare`, `methodology`. |
| `components/` | Közös építőelemek: `Modal` (felugró panel), `Value` (hiányzó érték jelölése). |
| `styles/` | Stíluslapok: `base` (színek, betűk), `layout`, `components`, `pages`. |
| `assets/fonts/` | Helyben tárolt IBM Plex betűtípusok (internet nélkül is működik). |

### A `domain/` mappa részletesen

| Fájl | Mit csinál? |
|---|---|
| `types.ts` | Az adatbázis-rekord TypeScript-típusa. |
| `format.ts` | Számformázás, „Not recorded”, biztonságos linkek. |
| `matching.ts` | Az annotációtípus-szűrő kifejezései (csak az annotáció mezőt nézi). |
| `chooser.ts` | „Melyiket válasszam?”: négy kérdés, feltételenként teljesül / nem teljesül / nem ellenőrizhető. Nincs pontszám; a hiányzó érték soha nem számít teljesítettnek. |
| `quickFilters.ts` | Gyorsszűrők (pl. „12 elvezetéses”): csak a meglévő szűrőket állítják be, így ugyanazt adják, mint a kézi szűrés. |
| `search.ts` | Szabad szöveges keresés, szűrők, rendezés (a hiányzó érték mindig a lista végére kerül). |
| `completeness.ts` | 16 mező kitöltöttsége („Documented: 15/16”). |
| `fair.ts` | FAIR-elvekhez kapcsolódó dokumentációs ellenőrzések (x / y, nem pontszám). |
| `compare.ts` | Az összehasonlító tábla sorai, eltérések, kulcsfontosságú eltérések. |
| `csv.ts` | Biztonságos CSV-export. |

## Kétnyelvű felület

A fejlécben HU / EN gombbal lehet nyelvet váltani; alapból magyar, és a böngésző
megjegyzi a választást. Minden felirat egy `{ hu, en }` pár (`i18n/strings.ts`,
illetve a `domain/` mezőnevei), a komponensek a `t()` függvénnyel választják ki az
aktuálisat. Külső könyvtár nem kell hozzá. Az **adatértékek nem fordulnak**:
a kategória, annotáció, leírás és licenc a PhysioNet eredeti angol szövege, így a
forrást pontosan idézik. Egy teszt ellenőrzi, hogy minden mezőnek van magyar és angol neve.

## A dizájn elvei (erre is rákérdezhetnek)

A felület egy tudományos adatkatalógusra hasonlít, nem marketingoldalra:

- egyetlen kiemelőszín (sötétkék) a linkekhez és a kijelöléshez;
- minden szín CSS-változó (`styles/base.css`), a sötét mód csak ezek értékét cseréli le, így nincs két külön stíluslap;
- nincs színátmenet, árnyék, dekoratív ikon és „kártya”, a tartalmat vékony vonalak tagolják;
- a fő nézet egy rendezhető táblázat, mert a felhasználó számokat hasonlít össze;
- a számok egyforma szélességű számjegyekkel, jobbra igazítva jelennek meg, így oszlopban összevethetők;
- a hiányzó érték dőlt, halvány „Not recorded”: látszik, de nem tűnik valódi adatnak;
- nincs összesítő „KPI-doboz” és diagram, mert 21 rekordnál ezek nem mondanak többet a táblázatnál.
- széles képernyőn (legalább 1600 px) a katalógus három oszlopos: szűrők, táblázat, és jobb oldalt állandó adatlap-panel (master-detail). A sorra kattintva ott jelennek meg a részletek; amíg nincs kiválasztás, a panel a katalógusból számolt, ellenőrizhető tényeket mutatja (`features/catalog/CatalogOverview.tsx`). Keskenyebb képernyőn ugyanez az adatlap jobbról nyíló ablakként jelenik meg. A váltást a `hooks/useMediaQuery.ts` (`WIDE_LAYOUT_QUERY`) dönti el, az adatlap tartalma (`DatasetDetailBody`) mindkét esetben ugyanaz a komponens.

## Egy kattintás útja – példa a védésre

„A felhasználó a katalógusban beállítja: *Annotation type = Rhythm annotations*, *Minimum sampling rate = 250 Hz*.”

1. `features/catalog/CatalogFilters.tsx` eltárolja a két feltételt.
2. `CatalogPage.tsx` meghívja a `domain/search.ts` → `filterCatalog` függvényt a teljes katalógussal.
3. Ez minden adatbázisra megnézi:
   - `matching.ts`: szerepel-e a „rhythm” kifejezés az annotáció mezőben;
   - a frekvencia ≥ 250 Hz? Ha a frekvencia nincs rögzítve, az **nem** számít teljesítettnek.
4. Az eredményt a `sortCatalog` rendezi, és a táblázat megjeleníti.
5. Egy névre kattintva az URL `#/catalog?dataset=…` lesz, és megnyílik az adatlap.

## Tesztek

- Backend: `pytest` (API, adatellenőrzés, migráció, a `catalog.json` adatminősége).
- Frontend: `npm run test:domain` a `domain/` szabályaira.
- Ezen felül: TypeScript-ellenőrzés (`tsc`), lint (`oxlint`), production build.
