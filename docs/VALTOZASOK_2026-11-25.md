# Változások – 2026-11-25 (rendbetétel: 0–1. fázis)

Cél: működő, rendezett, bemutatható alap, amire a következő funkciók
(Source Provenance, Quality Inspector, Citation, Passport) biztonságosan épülhetnek.
Új funkciót nem adtunk hozzá; a meglévők működnek, csak jobban és ellenőrizhetőbben.

## Biztonsági mentések

- `backend/backups/ekg_metadata-before-phase0-20261125.db` – az adatbázis a módosítás előtt.
- `backend/backups/source-before-phase0-20261125.zip` – a teljes eredeti forráskód (adatbázis nélkül).

Ha bármi gond van, ezekből minden visszaállítható.

## Adat

- Mind a 21 rekord egy verziókezelt fájlba került: `backend/data/catalog.json`.
- PhysioNet-ellenőrzés alapján javítva: licencnevek egységesítése, hozzáférési
  feltételek, a CINC2017 hibás LightWAVE-linkje, a Chapman–Shaoxing személyszáma.
  Részletek és nyitott kérdések: `ADATELLENORZES_2026-11-25.md`.
- 17 magyar leírás angolra fordítva (a felület angol).
- Az adatbázis szerkezete (2. sémaverzió): a rekordszám, frekvencia és
  elvezetésszám lehet „ismeretlen” (`null`); nincs többé 0 / 250 Hz / 2 alapérték.

## Backend

- A 661 soros `main.py` modulokra bontva (`app/`: config, fields, db, schemas, security, routers).
- Az API címei és válaszai változatlanok.
- Új ellenőrzések: DOI-formátum, dátumformátum (`last_verified`), negatív számok.
- Az adatbázis-kapcsolat mindig lezárul; az elavult `on_event` helyett `lifespan`.
- Törölve: a használaton kívüli `models.py`, `database.py` (SQLModel, már nem is volt telepítve) és a lezárt legacy-migrációs kód.
- Az egyszeri javítószkriptek a `scripts/archive/` mappába kerültek (magyarázattal).
- Tesztek: 14 → **30**. Újak: szerkesztés, törlés, duplikált név, DOI/dátum, hiányzó számok, migráció, `catalog.json` adatminőség. A tesztek már nem nyúlnak az éles adatbázishoz.

## Frontend

- A 2127 soros `App.tsx` szétbontva: `App.tsx` ~230 sor, a többi oldalanként a `features/` mappában. A szabályok a `domain/` mappában, React nélkül tesztelhetően.
- A 2960 soros `App.css` témánként 10 fájlra bontva (`styles/`).
- URL-alapú navigáció: működik a Vissza gomb, és egy adatlap linkelhető (`#/catalog?dataset=1`).
- Javított hibák:
  - a licencszűrőben kétszer szerepelt ugyanaz a licenc;
  - az annotációszűrő „Signal quality” opciója kihagyta a MITDB-t és az EDB-t (kötőjel);
  - a Finder a linkekben és a leírásban is keresett, ezért téves találatokat adott (pl. ST/T → LUDB, QTDB); most csak a klinikai fókuszt, az annotációt és a nevet nézi, és megmondja, hol talált egyezést;
  - a törlés-ablak korábbi sikerüzenetet mutathatott hibaként;
  - az adatlapon a hiányzó mezők eltűntek – most „Not recorded” jelölést kapnak;
  - a „Save” és a „Remove from comparison” gomb kizökkentett (átvitt másik oldalra).
- Admin űrlap: mind a 21 mező szerkeszthető, szekciókba rendezve; az üres mező hiányzóként mentődik (nincs 0 / 250 Hz / mai dátum alapérték).
- Felugró ablakok: fókusz az ablakban marad, Esc bezár, a fókusz visszatér (akadálymentesség).
- Metadata completeness: 13 → 16 mező (a rekordszám, frekvencia, elvezetés is számít).
- FAIR: „x / y ellenőrzés” százalék helyett; kivéve a mindig igaz ellenőrzéseket. Eredmény: a Reusable elvnél 21-ből 10 adatbázis teljes – a nézet most valódi hiányt mutat (főleg a személyszámot).
- Compare: a kutatási szempontból kulcsfontosságú eltérések (méret, frekvencia, elvezetés, annotáció, formátum, licenc) külön összesítve és ◆ jellel jelölve.
- Katalógus: külön „Subjects” oszlop a „Records” mellett.
- Domain-tesztek: 10 → **17**.

## Dizájn

- Eltávolítva a minden oldal tetején lévő díszítő, nem valódi EKG-görbe.
- Statisztika: a különböző adatbázisok rekordszámainak összege (értelmezhetetlen szám) helyett: személyszám dokumentáltsága és LightWAVE-elérhetőség; új diagram az elvezetésszámról.
- A funkcióoldalakon nincs többé dupla cím.
- Betűtípusok a projektben (DM Sans, Manrope, IBM Plex Mono; OFL licenc) – nincs Google Fonts hívás, internet nélkül is ugyanúgy néz ki.
- Törölve a Vite-sablon maradékai (`index.css`, `hero.png`, `react.svg`, `vite.svg`).

## Lefuttatott ellenőrzések (Linuxon, a projekt másolatán)

| Ellenőrzés | Eredmény |
|---|---|
| Backend `pytest` | 30/30 sikeres, figyelmeztetés nélkül |
| Frontend domain-tesztek | 17/17 sikeres |
| TypeScript (`tsc -b`) | hibátlan |
| Lint (`oxlint`) | 0 hiba, 0 figyelmeztetés |
| Production build | sikeres |
| API (élő szerver a migrált adatbázison) | `/health`, `/datasets` (21), `/datasets/search`, `/datasets/9` → 200 |
| SQLite `integrity_check` | ok |
| Böngészős nézet (headless Chrome, 1440 px és 390 px) | Katalógus, adatlap, Finder, Compare, Quality, Statistics, My Research betölt és megjelenik |

Nem ellenőriztem kézzel kattintgatva az admin folyamatot a böngészőben (az API-szintű tesztek lefedik), és nem futtattam Windows alatt.

## Hogyan mutasd be a védésen?

1. **Hiányzó adat:** nyiss meg egy adatlapot (pl. CUDB) → „Subjects: Not recorded”. Mondd el: a rendszer soha nem talál ki adatot; ez az adatbázis szintjén is így van (a migráció eltávolította a 250 Hz-es alapértéket).
2. **Finder indoklás:** válaszd az „ST / T-wave analysis” fókuszt → csak az EDB és az LTSTDB jön ki, mellettük az indoklás, melyik mezőből.
3. **FAIR:** a Reusable oszlopban 21-ből csak 10 teljes – mutasd meg, melyik ellenőrzés hiányzik, és hangsúlyozd, hogy ez dokumentációs ellenőrzőlista, nem tanúsítvány.
4. **Adatellenőrzés:** `ADATELLENORZES_2026-11-25.md` – hogyan derült ki, hogy a CINC2017 LightWAVE-linkje hibás volt.
