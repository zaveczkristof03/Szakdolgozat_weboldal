# Adatellenőrzés a PhysioNeten – 2026-11-25

Mind a 21 adatbázis hivatalos PhysioNet-oldalát megnyitottam, és négy dolgot
néztem meg rajtuk: van-e „Visualize waveforms” (LightWAVE) link, mi a licenc
pontos neve, mi a hozzáférési szabály, és mi a verzió DOI-ja.

## Eredmény

| Mit ellenőriztem | Eredmény | Mit változtattam |
|---|---|---|
| LightWAVE-link | 20 oldalon van, a link azonosítója mindenhol megegyezik a `source_database_id`-vel. A **PhysioNet/CinC Challenge 2017** oldalán **nincs** ilyen link. | A CINC2017 `lightwave_database_id` mezője üres lett. A többi 20 marad. |
| Licenc | 19 adatbázis: *Open Data Commons Attribution License v1.0*. PTB-XL és Chapman–Shaoxing: *Creative Commons Attribution 4.0 International Public License*. | A két CC-licenc eddig két különböző néven szerepelt („CC BY 4.0” és a hosszú név), ezért a szűrőben kétszer jelent meg. Most mindkettő a PhysioNet által használt pontos nevet kapta. |
| Hozzáférés | Mind a 21 oldalon ugyanaz: „Anyone can access the files, as long as they conform to the terms of the specified license.” | Az `access_conditions` mező mind a 21 rekordnál ezt a szöveget kapta. 15 rekordnál eddig „verify licence on the official data page” állt, ami ellentmondott a kitöltött licencnek. |
| DOI | Mind a 21 DOI egyezik a hivatalos oldallal. | Nincs változás. |
| Chapman–Shaoxing személyszám | Az oldal szerint „45,152 patients”, és betegenként egy EKG. | `subject_count` = 45 152 (eddig üres volt). A rekordszám (45 152) változatlan. |

Megjegyzés a korábbi felméréshez: ott azt írtam, hogy a LightWAVE-azonosítók
nagy része nincs igazolva. Ez a kódban lévő régi „igazolt” listára épült, ami
elavult volt. A valóság: 21-ből 20 helyes, 1 hibás volt.

## Amit NEM tudtam ellenőrizni (nyitott kérdés)

- **CUDB elvezetésszám (most 2):** a hivatalos oldal nem írja le, hány EKG-jel
  van egy rekordban. Tudomásom szerint rekordonként egy, de ezt a rekordok
  fejlécfájljából (`.hea`) kell igazolni. Nem módosítottam.
- **Fantasia elvezetésszám (most 2):** az oldal szerint minden rekordban van EKG
  és légzés (egyes rekordokban vérnyomás is), de az EKG-elvezetések számát nem
  adja meg. Valószínű, hogy a 2 itt jelcsatornát jelent, nem elvezetést. Nem
  módosítottam.
- Általános kérdés: a `leads` mező a jelenlegi adatokban néhol „jelcsatornát”
  jelent (pl. PTBDB 15 = 12 standard + 3 Frank-elvezetés). Ezt a mezőszintű
  forráskezelés (Source Provenance) bevezetésekor érdemes rendezni.

## Leírások nyelve

17 leírás magyar volt, 4 angol, a felület angol. A 17 magyar leírást
tartalmilag változatlanul angolra fordítottam (új állítás nem került beléjük).

## Ellenőrzés dátuma

A `last_verified` mezőt **nem** írtam át 2026-11-25-re, mert csak a fenti
mezőket ellenőriztem, nem a teljes rekordot (pl. a rekordszámot vagy az
időtartamot nem). Ezt a mezőszintű forráskezelés fogja pontosan kezelni.
