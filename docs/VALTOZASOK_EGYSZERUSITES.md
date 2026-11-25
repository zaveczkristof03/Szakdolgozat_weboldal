# Változások – egyszerűsítés és új dizájn (2026-11-25)

Cél: egy egyszerű, jól működő és könnyen megvédhető alkalmazás. A felesleges
részeket kivettük, a megmaradtakat egy visszafogott, táblázatközpontú felületre
rajzoltuk át.

## Mi került ki, és miért?

| Kivett rész | Miért? | Mi lett vele? |
|---|---|---|
| Admin (bejelentkezés, létrehozás, szerkesztés, törlés) | Az adatok ritkán változnak, és minden változást forrással kell igazolni. A verziókezelt `catalog.json` ezt jobban szolgálja, és a weben nincs jelszó, amit fel lehetne törni. | Az API csak olvasható. A `POST/PUT/DELETE /datasets` és az `/admin/*` végpontok megszűntek. Az adatellenőrzés (DOI, dátum, link) megmaradt, a JSON betöltésekor fut. |
| Statistics | 21 rekordnál a diagramok nem mondanak többet a táblázatnál, és díszítésnek hatnak. | – |
| Research Fit Finder | Átfedésben volt a katalógus szűrőivel. | A katalógus szűrői (annotációtípus, frekvencia, elvezetés stb.) lefedik. |
| My Research (gyűjtemények) | Az összehasonlítás nagyrészt lefedi, és a böngészőben tárolt adat zavaró lehet. | – |
| Metadata Quality oldal | A mérés hasznos, de nem kell rá külön oldal. | Minden adatlapon látszik („15 of 16 fields”, mi hiányzik, FAIR-ellenőrzések), a katalógusban „Documented” oszlop, a teljes magyarázat és táblázat a **Methodology** oldalon. |

## Új vagy átalakított részek

- **Felső menü** három ponttal (Catalog, Compare, Methodology) az oldalsáv helyett.
- **Katalógus:** bal oldalt szűrők, jobbra rendezhető táblázat, jelölőnégyzet az összehasonlításhoz.
  A „Not recorded” értékek rendezéskor mindig a végére kerülnek.
- **Adatlap:** jobbról nyíló panel, mögötte látszik a táblázat.
- **Methodology oldal:** adatforrás, olvasási szabályok, a „Documented” számítása, FAIR-ellenőrzések, korlátok.
- **Dizájn:** IBM Plex betűk, egyetlen kiemelőszín, nincs színátmenet, árnyék, dísz-ikon és KPI-doboz.
  Az elvek: `docs/ARCHITEKTURA_HU.md`, „A dizájn elvei”.
- Az `INDITAS_EGYSZERU.bat` már nem kér jelszót.

## Ellenőrzés (Linuxon futtatva)

- Backend: `pytest` – 21 teszt sikeres (az admin-tesztek helyett: az API valóban csak olvasható,
  és az adatellenőrzés közvetlenül a sémán tesztelve).
- Frontend: `npm run test:domain` – 10 teszt sikeres (új: rendezés a hiányzó értékekkel).
- `tsc`, `oxlint` (0 figyelmeztetés), `vite build` sikeres.
- Böngészőben (headless Chrome, 1440 px és 390 px): katalógus, rendezés, kijelölés,
  adatlap, összehasonlítás, módszertan; konzolhiba nem volt.
- Windowson nem futtattuk.
