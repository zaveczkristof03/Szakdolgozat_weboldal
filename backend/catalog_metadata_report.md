# EKG Metadata Explorer – katalógus-metaadatok javítási jegyzőkönyve

Dátum: 2026-10-29

## Mi készült el

- A `catalog_seed.json` 17 új adatkészletének mindegyikéhez egyedi, magyar nyelvű leírás került.
- A hivatalos PhysioNet-oldalakon igazolható licencek és DOI-k bekerültek, ahol a keresés során megerősíthetők voltak.
- A Chapman–Shaoxing/Ningbo rekordnál a licencet és DOI-t szándékosan nem töltöttük ki, mert a jelen ellenőrzés során nem sikerült őket megbízhatóan megerősíteni.
- A frissítőszkript nem módosítja a meglévő `records`, `frequency`, `leads`, `category` mezőket vagy az adatbázis-azonosítókat.
- A négy korábbi adatkészletet nem törli és nem szúrja be újra.
- Az üres/ellenőrizetlen seed mezők nem írják felül a már létező adatbázisértékeket.

## Fájlok

1. `catalog_seed_improved.json` – javított seed JSON. Másold be a backend mappába `catalog_seed.json` néven.
2. `update_catalog_metadata.py` – meglévő adatbázissorok biztonságos frissítése, automatikus SQLite-mentéssel.
3. `catalog_seed_original.json` – az eredeti seed másolata, ha elérhető.

## A 17 seed-rekord hivatalos forrásai

| Adatkészlet | Hivatalos forrás |
|---|---|
| MIT-BIH Long-Term ECG Database | https://physionet.org/content/ltdb/1.0.0/ |
| MIT-BIH Normal Sinus Rhythm Database | https://physionet.org/content/nsrdb/1.0.0/ |
| MIT-BIH Noise Stress Test Database | https://physionet.org/content/nstdb/1.0.0/ |
| QT Database | https://physionet.org/content/qtdb/1.0.0/ |
| PTB Diagnostic ECG Database | https://physionet.org/content/ptbdb/1.0.0/ |
| St Petersburg INCART 12-lead Arrhythmia Database | https://physionet.org/content/incartdb/1.0.0/ |
| Long Term ST Database | https://physionet.org/content/ltstdb/1.0.0/ |
| MIT-BIH Supraventricular Arrhythmia Database | https://physionet.org/content/svdb/1.0.0/ |
| Creighton University Ventricular Tachyarrhythmia Database | https://physionet.org/content/cudb/1.0.0/ |
| Sudden Cardiac Death Holter Database | https://physionet.org/content/sddb/1.0.0/ |
| MIT-BIH Malignant Ventricular Ectopy Database | https://physionet.org/content/vfdb/1.0.0/ |
| BIDMC Congestive Heart Failure Database | https://physionet.org/content/chfdb/1.0.0/ |
| Fantasia Database | https://physionet.org/content/fantasia/1.0.0/ |
| Long Term AF Database | https://physionet.org/content/ltafdb/1.0.0/ |
| Lobachevsky University Electrocardiography Database | https://physionet.org/content/ludb/1.0.1/ |
| Chapman-Shaoxing and Ningbo ECG Database | https://physionet.org/content/ecg-arrhythmia/1.0.0/ |
| PhysioNet/CinC Challenge 2017 Database | https://physionet.org/content/challenge-2017/1.0.0/ |

## Fontos korlátok

- Ez a csomag a 17 seedben szereplő új rekord metaadatait frissíti. A négy eredeti rekordot szándékosan békén hagyja; azok teljes adatlapját a projekt aktuális adatbázisából/CSV-exportjából külön kell ellenőrizni.
- A leírások és a licencek/DOI-k hivatalos adatoldalak alapján készültek. A `records`, `subject_count`, `frequency`, `leads`, illetve egyes időtartam- és annotációmezők meglévő számait nem írjuk át automatikusan, mert ehhez külön, mezőnkénti audit szükséges.
- A forrásoldal „open access” jelölése nem helyettesíti a licencet; a hozzáférési feltételeket külön mező tárolja.
- A teljes backendteszteket, frontend lintet és production buildet ebben a környezetben nem futtattuk, mert a teljes projektmappa és a helyi adatbázis nem volt feltöltve. A JSON szerkezeti ellenőrzése és a frissítőszkript Python-szintaktikai ellenőrzése sikeres volt.

## Futtatás

A `catalog_seed_improved.json` fájlt másold a projekt `backend` mappájába `catalog_seed.json` néven. A `update_catalog_metadata.py` fájlt ugyanoda másold. PowerShellből futtasd:

```powershell
cd C:\Users\zavec\Documents\ekg-metadata-explorer\backend
.\.venv\Scripts\python.exe update_catalog_metadata.py
```

A szkript az adatbázisról időbélyeges, konzisztens SQLite-mentést készít a `backend/backups` mappába, majd a meglévő rekordok leíró mezőit frissíti. A végén ellenőrizd az API-t és tölts le új CSV-exportot. A teljes tesztfuttatást a frissítés után kell elvégezni.
