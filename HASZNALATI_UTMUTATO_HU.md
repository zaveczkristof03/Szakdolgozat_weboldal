# EKG MetaData Explorer – magyar használati útmutató

Az alkalmazás nyilvános EKG-adatbázisok **metaadatait** mutatja meg: segít megtalálni,
megvizsgálni és összehasonlítani őket. Nem elemez EKG-jeleket, és nem ad orvosi vagy
kutatásmódszertani ajánlást.

Három oldal van, a felső menüből érhetők el: **Katalógus**, **Összehasonlítás**, **Módszertan**.
A jobb felső sarokban a **HU / EN** gombbal lehet nyelvet váltani (alapból magyar), a **Sötét mód / Világos mód** gombbal pedig témát. Mindkettőt megjegyzi a böngésző; a téma első látogatáskor a rendszerbeállítást követi.
Az adatértékek (kategória, annotáció, leírás, licenc) mindkét nyelven a PhysioNet eredeti angol szövegei.
Minden oldalnak és adatlapnak saját címe van (`#/catalog`, `#/compare`, `#/methodology`,
`#/catalog?dataset=1`), így működik a böngésző Vissza gombja, és egy adatlapra linket lehet küldeni.

## 1. Catalog – katalógus

Bal oldalt a kereső és a szűrők, jobbra a találatok táblázata.

- **Search:** a név, rövid név, kategória, leírás, annotáció, rekordleírás, DOI, verzió,
  forrásazonosító, fájlformátum, licenc és hozzáférési feltétel mezőkben keres.
  A linkekben szándékosan nem, mert ott a szavak más értelemben is előfordulnak.
- **Szűrők:** klinikai fókusz, annotációtípus, elvezetésszám, minimális mintavételezési
  frekvencia, fájlformátum, licenc. Ha egy érték nincs rögzítve, az nem felel meg a szűrőnek.
- **Gyorsszűrők:** a táblázat fölötti gombok egy kattintással beállítják a gyakori szűréseket (12 elvezetéses, pitvarfibrilláció, legalább 500 Hz, szívütés- vagy hullámhatár-annotáció). A szám a találatok száma. Újrakattintásra a szűrés törlődik.
- **Rendezés:** az oszlopfejlécre kattintva. A „Not recorded” értékek mindig a lista végére kerülnek.
- **Documented:** a 16 vizsgált mezőből hány van kitöltve (lásd Methodology).
- **Összehasonlítás:** a sor elején lévő jelölőnégyzettel, legfeljebb négy adatbázis.
- **Export CSV:** a szűrt sorokat és minden mezőt menti; a hiányzó érték üres cella marad.

A `Records` a felvételek, a `Subjects` a vizsgált személyek száma. A kettő külön érték,
mert egy személytől több felvétel is származhat.

## 2. Adatlap

Egy adatbázis nevére kattintva jobbról megnyílik az adatlap. Itt minden mező látszik
(a hiányzók „Not recorded” jelöléssel), linkek a PhysioNet-oldalra és – ha van igazolt
azonosító – a LightWAVE jelnézegetőre. Az alján a **Documentation** rész mutatja,
hány mező van kitöltve, mi hiányzik, és a FAIR-elvekhez kapcsolódó ellenőrzések
eredményét (x / y formában). Bezárás: Close gomb vagy Esc.

## 3. Compare – összehasonlítás

Legfeljebb négy adatbázis egymás mellett, mezőcsoportonként (azonosítók, méret,
jelstruktúra, annotációk, technikai adatok, hozzáférés, forrás). A kutatási szempontból
kulcsfontosságú eltérések (rekord- és személyszám, mintavételezés, elvezetésszám,
annotáció, fájlformátum, licenc) kék hátteret és „(differs)” jelölést kapnak.
Az **Only show differences** elrejti az egyező sorokat. Adatbázist a katalógusból vagy az
oldal tetején lévő listából lehet hozzáadni. A CSV-export a látható sorokat menti.

Az azonos elnevezés önmagában nem garantálja, hogy két adatbázisban a „rekord”
ugyanazt jelenti; ezért van mellette a rekordleírás is.

## 4. Methodology – módszertan

Leírja, honnan származnak az adatok, a két olvasási szabályt (rekord ≠ személy;
„Not recorded” = ismeretlen), a „Documented” számítását a 16 mező felsorolásával és
adatbázisonkénti eredménnyel, a FAIR-hez kapcsolódó ellenőrzéseket, valamint a korlátokat.
A FAIR-ellenőrzés **nem tanúsítvány és nem pontszám**, csak azt mutatja, mi van dokumentálva.
A szakdolgozat módszertani fejezete erre az oldalra hivatkozhat.

## 5. Az adatok módosítása

A 21 rekord a `backend/data/catalog.json` fájlban van. Webes szerkesztés nincs: a fájlt
kell átírni (a változást a PhysioNet-oldallal igazolva), majd betölteni:

```powershell
cd backend
.\.venv\Scripts\python.exe scripts\catalog_sync.py import
```

Betöltés előtt automatikus mentés készül a `backend/backups/` mappába, és minden rekord
ellenőrzésen megy át. A legutóbbi PhysioNet-ellenőrzés: `docs/ADATELLENORZES_2026-11-25.md`.

## 6. Indítás Windows alatt

Legegyszerűbb: dupla kattintás az `INDITAS_EGYSZERU.bat` fájlra. Kézzel, két terminálban:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

A weboldal: `http://localhost:5173`. Az API: `http://127.0.0.1:8000`, dokumentációja: `/docs`.
A betűtípusok a projektben vannak, így internet nélkül (a védésen) is ugyanúgy néz ki.

## 7. Ellenőrzések

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest tests -q

cd ..\frontend
npm.cmd run test:domain
npm.cmd run lint
npm.cmd run build
```

A backend tesztek ideiglenes adatbázison futnak, az éles `ekg_metadata.db`-hez nem nyúlnak.
A kód felépítése kezdőknek: `docs/ARCHITEKTURA_HU.md`.
