# Fejlesztési változások – EKG MetaData Explorer

> Megjegyzés (2026-11-25): az itt leírt Research Fit Finder, My Research, Statistics és admin funkciók később kikerültek az alkalmazásból. Lásd `docs/VALTOZASOK_EGYSZERUSITES.md`.

## Új funkciók

1. **Research Fit Finder** – szabályalapú, magyarázható keresés kutatási fókusz, EKG-elvezetések száma, mintavételezés, annotáció, fájlformátum, rekordszám és személyszám alapján. A hiányzó adat nem számít teljesített feltételnek.
2. **Metadata Completeness** – 13 opcionális leíró metaadatmező kitöltöttségét számolja és megmutatja, mely mezők nincsenek rögzítve.
3. **FAIR Readiness Signals** – a Findable, Accessible, Interoperable és Reusable elvekhez kapcsolódó katalógusbizonyítékokat mutatja. Nem tanúsítvány, nem helyettesít teljes FAIR-auditot.
4. **Advanced Compare** – maximum négy adatbázis összehasonlítása; különbségek és hiányzó értékek szűrése; a látható összehasonlítás CSV-exportja.
5. **My Research** – saját kutatási gyűjtemények, dataset-jegyzetek és export. A mentések a böngésző helyi tárhelyén maradnak.

## Minőségi javítások

- A teljes katalógus egyszer töltődik be, az oldalnézetek ugyanazt a teljes adatkészletet használják.
- A katalogus annotációs szűrője csak a dedikált `annotations` mezőt használja, így nem következtet tévesen a klinikai kategóriából.
- Az adminisztrációs szerkesztés megőrzi a meglévő részletes metaadatokat.
- A CSV-kimenet kezeli az idézőjeleket és semlegesíti a képletnek tűnő cellakezdéseket.
- A mentett gyűjtemények beolvasása kiszűri a hibás vagy ismétlődő azonosítókat és az érvénytelen jegyzetértékeket.
- A négyes összehasonlítási korlát minden belépési ponton érvényesül.

## Ellenőrzések

- Domain-tesztek: 10/10 sikeres.
- Backend-tesztek: 14/14 sikeres.
- TypeScript ellenőrzés: sikeres.
- Design Taste lint: 0 FAIL / 0 WARN.
- API smoke test: `GET /datasets` HTTP 200, 21 rekord.
- SQLite `PRAGMA integrity_check`: `ok`.

A teljes Vite buildet és a böngészős vizuális tesztet a platformfüggő Windowsos Node-függőségek miatt ebben a Linux-környezetben nem sikerült futtatni. Windows alatt `npm.cmd install`, `npm.cmd run build` és a helyi böngészős ellenőrzés szükséges.

---

**2026-11-25:** a kód és az adatok rendbetétele (modulokra bontás, hibajavítások,
PhysioNet-ellenőrzés). Részletek: `docs/VALTOZASOK_2026-11-25.md`.
