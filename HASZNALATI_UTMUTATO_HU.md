# EKG MetaData Explorer – magyar használati és fejlesztési útmutató

Ez a dokumentum az alkalmazás kutatási funkcióit, azok számítási logikáját és a helyi indítást magyarázza el. A rendszer a katalógusban tárolt EKG-adatbázisok **metaadatait** dolgozza fel; nem értékel klinikai EKG-jeleket, és nem ad orvosi vagy kutatásmódszertani ajánlást.

## 1. Az alkalmazás röviden

Az EKG MetaData Explorer egy olyan katalógus, amely segít nyilvánosan dokumentált EKG-adatbázisokat megtalálni, metaadataikat megvizsgálni és egymással összehasonlítani. A fő munkafolyamat:

1. EKG-adatbázisok keresése és szűrése.
2. A kutatási feladat követelményeinek beállítása.
3. A lehetséges adatbázisok összehasonlítása.
4. A metaadatok dokumentáltságának áttekintése.
5. A kiválasztott adatbázisok saját kutatási gyűjteménybe mentése és exportálása.

## 2. Database Catalog – adatbázis-katalógus

A katalógus a backend API-ból tölti be az összes adatbázist. A keresés a név, rövid név, kategória, leírás, annotáció, rekordleírás, DOI, verzió, adatbázis-azonosító, fájlformátum, licenc és hozzáférési feltétel mezőkben keres. A linkekben (URL) szándékosan nem keres, mert ott a szavak más értelemben is előfordulnak.

A szűrők az alapvető jeljellemzőket és a dokumentált technikai információkat használják:

- mintavételezési frekvencia (Hz);
- klinikai kategória;
- EKG-elvezetések száma;
- licenc;
- annotációs leírás;
- dokumentált fájlformátum.

A `Records` a rekordok (felvételek) számát, a `Subjects` a vizsgálati személyek számát jelenti; a táblázatban mindkettő külön oszlopban látszik. Ha egy érték nincs igazolva, a felület „Not recorded” jelölést mutat – a rendszer soha nem helyettesíti becsült vagy alapértékkel.

Minden oldalnak saját címe van (`#/catalog`, `#/finder`, `#/compare`, `#/quality`, `#/statistics`, `#/research`), és egy adatlap is linkelhető, például `#/catalog?dataset=1`. Így működik a böngésző Vissza gombja is.

## 3. Research Fit Finder – követelményalapú keresés

A Finder nem mesterséges intelligenciával rangsorol, és nem állítja, hogy egy adatbázis klinikailag „a legjobb”. Átlátható, szabályalapú szűrést végez a katalógusban dokumentált mezők alapján.

Beállítható követelmények:

- kutatási fókusz (például pitvarfibrilláció, ritmuszavar, ST/T-hullám, zaj/jelminőség);
- EKG-elvezetések száma;
- minimális mintavételezési frekvencia;
- szükséges annotációtípus;
- fájlformátum;
- minimális rekordszám;
- minimális személyszám.

Minden feltétel opcionális. A rendszer csak azt a rekordot adja vissza találatként, amelynél **minden kiválasztott feltétel teljesül a rögzített metaadat alapján**. Ha egy szükséges mező hiányzik, a rekord nem kerül automatikusan a találatok közé: a kizárt adatsoroknál a felület megmutatja, mit nem lehetett igazolni.

A kutatási fókusz a **klinikai fókusz, az annotáció és a név** mezőkben keres előre rögzített kifejezéseket (a kötőjeleket szóközként kezelve), és az indoklásban megmondja, melyik mezőben és milyen értékkel talált egyezést. A leírásban és a linkekben nem keres, mert ez korábban téves találatokat adott (pl. az „ST/T” fókusz kiadta a hullámhatár-annotációs adatbázisokat). A nyers EKG-fájlok tartalmát a rendszer nem vizsgálja.

## 4. Compare Datasets – összehasonlítás

Egyszerre legfeljebb négy adatbázis választható ki. A korlát a katalógusból, a Finderből és a mentett gyűjteményből érkező kijelölésekre is érvényes.

A kutatási szempontból **kulcsfontosságú eltéréseket** (rekord- és személyszám, mintavételezés, elvezetésszám, annotáció, fájlformátum, licenc) a tábla fölött külön összesítjük, a sorokat pedig ◆ jel jelöli.

Az összehasonlító tábla csoportjai:

- azonosítók (rövid név, verzió, DOI, forrásazonosító);
- méret (rekordszám, személyszám);
- jelstruktúra (mintavételezés, elvezetések, időtartam, rekordleírás);
- annotációk;
- technikai adatok (fájlformátum);
- hozzáférés és újrafelhasználás (licenc, hozzáférési feltételek);
- forrás és ellenőrzés;
- LightWAVE-azonosító.

A `Show differences only` elrejti azokat a sorokat, ahol minden kiválasztott adatbázisban ugyanaz az érték szerepel. A `Show missing metadata` ki- és bekapcsolja a hiányzó mezőket tartalmazó sorok megjelenítését. A CSV-export a képernyőn aktuálisan látható összehasonlító sorokat exportálja.

Az összehasonlítás a metaadat-mezőkben szereplő értékeket veti össze. Az azonos elnevezés önmagában nem garantálja, hogy két adatbázisban a mögöttes rekorddefiníció teljesen azonos.

## 5. Metadata Quality – metaadat-teljesség és FAIR-ellenőrzések

### Metadata completeness

A teljességi arány 16 metaadatmező kitöltöttségét méri: rövid név, verzió, DOI, forrásazonosító, rekordszám, rekordleírás, személyszám, mintavételezési frekvencia, elvezetésszám, időtartam, annotáció, fájlformátum, licenc, hozzáférési feltételek, eredetforrás (provenance) és utolsó ellenőrzés.

A képlet:

`kitöltött mezők / vizsgált mezők × 100`

A rekordszám, a frekvencia és az elvezetésszám 2026-11-25 óta szintén része a mérésnek: korábban ezek nem lehettek üresek (az adatbázis 0 / 250 Hz / 2 alapértéket adott nekik), ezért a hiányuk nem volt mérhető.

Ez a szám kizárólag a katalógus dokumentáltságát jellemzi. Nem méri az EKG-jelek minőségét, és azt sem, hogy a kitöltött érték helyes-e. Az adatbázisok a leghiányosabbtól a legteljesebbig rendezve jelennek meg, így azonnal látszik, hol kell további adatot gyűjteni.

### FAIR readiness – dokumentációs ellenőrzőlista

Minden FAIR-elvhez néhány konkrét, eldönthető kérdés tartozik:

- **Findable:** van-e jól formázott DOI, forrásazonosító, leírás és klinikai fókusz;
- **Accessible:** van-e http(s) forráslink és hozzáférési feltétel;
- **Interoperable:** rögzített-e a fájlformátum, a mintavételezési frekvencia, az elvezetésszám és a verzió;
- **Reusable:** rögzített-e a licenc, az annotáció, az eredetforrás, a felvételi időtartam és a személyszám.

A felület cellánként „teljesült / összes” formában mutatja az eredményt (pl. `4 / 5`), **nem százalékos pontszámként**. Az előző változat olyan ellenőrzéseket is tartalmazott, amelyek mindig igazak voltak (pl. „van neve”), ezért minden adatbázis 100%-ot kapott; ezeket kivettük. A forráslink ellenőrzése csak azt nézi, hogy rögzítve van-e, nem azt, hogy elérhető-e. Ez **nem FAIR-tanúsítvány és nem teljes FAIR-audit**.

## 6. My Research – saját kutatási gyűjtemények

A felhasználó több külön kutatási gyűjteményt hozhat létre, például „Pitvarfibrillációs kutatás” vagy „12 elvezetéses EKG-k”. A gyűjteményhez adatbázisokat menthet, saját megjegyzést írhat mindegyikhez, hozzáadhatja az aktuális összehasonlítás elemeit, és CSV-be exportálhatja a kiválasztást. A katalógusból történő mentés nem visz át másik oldalra; a felület egy állapotüzenetben jelzi, melyik gyűjteménybe került az adatbázis.

**Tárolás:** a gyűjtemények és jegyzetek a böngésző `localStorage` tárhelyén maradnak azon az eszközön és böngészőprofilban, ahol létrejöttek. Nem kerülnek a backend adatbázisába, nem szinkronizálódnak másik gépre. A böngésző webhelyadatainak törlése a gyűjteményeket is eltávolíthatja.

## 7. Statisztikák és export

A statisztikai oldal a betöltött katalógus adataiból számol: klinikai fókusz, mintavételezési frekvencia és elvezetésszám szerinti megoszlás, valamint ellenőrzési táblázat. A különböző adatbázisok rekordszámait **szándékosan nem adjuk össze**, mert az eltérő rekorddefiníciók miatt egy ilyen összeg nem értelmezhető.

A katalógus CSV-exportja a szűrt rekordokat és az összes metaadatmezőt menti; a hiányzó érték üres cella marad. Az export Excel-kompatibilis UTF-8 BOM fejlécet és idézőjelezést használ, és a képletnek látszó cellákat semlegesíti.

## 8. Az adatok forrása: `backend/data/catalog.json`

A katalógus mind a 21 rekordja verziókezelt JSON-fájlban van. Ez az „igazság forrása”: az `ekg_metadata.db` nincs a gitben, ezért egy friss letöltésből ebből építhető újra.

```powershell
cd backend
# JSON → adatbázis (előtte automatikus mentés a backups/ mappába; semmit nem töröl)
.\.venv\Scripts\python.exe scripts\catalog_sync.py import
# adatbázis → JSON (ha az admin felületen javítottál, és ezt verziókezelni szeretnéd)
.\.venv\Scripts\python.exe scripts\catalog_sync.py export
```

A 2026-11-25-i PhysioNet-ellenőrzés részletei: `docs/ADATELLENORZES_2026-11-25.md`.

## 9. Helyi indítás Windows alatt

Legegyszerűbb: kattints duplán az `INDITAS_EGYSZERU.bat` fájlra. Kézi indítás két külön terminálban:

### Backend

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
$env:EKG_ADMIN_PASSWORD = "saját-erős-helyi-jelszó"
.\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

Későbbi indításkor elég a `cd backend`, a jelszó beállítása és az utolsó parancs. Az első indításkor a backend automatikusan frissíti az adatbázis szerkezetét (2. sémaverzió), előtte mentést készít a `backend/backups/` mappába. A backend címe: `http://127.0.0.1:8000`, az automatikus API-dokumentáció: `http://127.0.0.1:8000/docs`.

### Frontend

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

A weboldal a `http://localhost:5173` címen érhető el. A betűtípusok a projektben vannak, így internet nélkül is ugyanúgy jelenik meg.

## 10. Ellenőrzések

```powershell
cd backend
$env:EKG_ADMIN_PASSWORD = "test-only-admin-password"
.\.venv\Scripts\python.exe -m pytest tests -q

cd ..\frontend
npm.cmd run test:domain
npm.cmd run lint
npm.cmd run build
```

A backend tesztek ideiglenes adatbázison futnak; az éles `ekg_metadata.db`-t nem olvassák és nem írják. A legutóbbi eredmények: `docs/VALTOZASOK_2026-11-25.md`.

## 11. Hol található a fontosabb kód?

A teljes, kezdőknek szóló térkép: `docs/ARCHITEKTURA_HU.md`. Röviden:

- `frontend/src/App.tsx` – összeköti az oldalakat, betölti a katalógust, kezeli a közös állapotot.
- `frontend/src/domain/` – a szabályok és számítások React nélkül (kereső, Finder, teljesség, FAIR, összehasonlítás, CSV, gyűjtemények). Ezeket tesztelik a domain-tesztek.
- `frontend/src/features/` – oldalanként egy mappa (catalog, finder, compare, quality, statistics, research, dataset, admin).
- `frontend/src/api/client.ts` – minden backend-hívás.
- `frontend/src/styles/` – a stíluslapok témánként.
- `backend/app/` – a FastAPI alkalmazás modulokra bontva (config, fields, db, schemas, security, routers).
- `backend/data/catalog.json` – a 21 ellenőrzött rekord.
- `backend/scripts/catalog_sync.py` – JSON ↔ adatbázis.
