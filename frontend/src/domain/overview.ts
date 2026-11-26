/**
 * Az Áttekintés oldal számításai: a katalógus megoszlása egy-egy jellemző szerint.
 *
 * Minden csoport darabszáma közvetlenül a katalógusból számolódik, és a csoporthoz
 * tartozó adatbázisok nevét is visszaadjuk (a grafikon ezt mutatja rámutatáskor).
 * A hiányzó érték külön, „Nincs adat” csoportba kerül, és mindig a lista végére –
 * soha nem soroljuk becsléssel egy meglévő csoportba.
 */
import type { Text } from '../i18n/lang.ts'
import { getCompleteness } from './completeness.ts'
import { fairDefinitions } from './fair.ts'
import { NOT_RECORDED } from './format.ts'
import type { ECGDatabase } from './types.ts'

export type Bucket = { key: string; label: Text; count: number; names: string[] }

const shortName = (db: ECGDatabase) => db.short_name ?? db.name

function group(databases: ECGDatabase[], keyOf: (db: ECGDatabase) => number | string | null, labelOf: (key: number | string) => Text, order: 'key' | 'count'): Bucket[] {
  const groups = new Map<number | string, ECGDatabase[]>()
  const missing: ECGDatabase[] = []
  for (const db of databases) {
    const key = keyOf(db)
    if (key === null || key === '') missing.push(db)
    else groups.set(key, [...(groups.get(key) ?? []), db])
  }
  const buckets = [...groups.entries()]
    .sort(([a, dbsA], [b, dbsB]) =>
      order === 'count' ? dbsB.length - dbsA.length || String(a).localeCompare(String(b)) : Number(a) - Number(b))
    .map(([key, dbs]) => ({ key: String(key), label: labelOf(key), count: dbs.length, names: dbs.map(shortName) }))
  if (missing.length > 0) buckets.push({ key: 'missing', label: NOT_RECORDED, count: missing.length, names: missing.map(shortName) })
  return buckets
}

const plain = (value: string): Text => ({ hu: value, en: value })

/** Megoszlás mintavételezési frekvencia szerint (növekvő Hz). */
export const byFrequency = (databases: ECGDatabase[]): Bucket[] =>
  group(databases, (db) => db.frequency, (hz) => plain(`${Number(hz).toLocaleString('hu-HU')} Hz`), 'key')

/** Megoszlás elvezetésszám (jelcsatorna-szám) szerint (növekvő). */
export const byLeads = (databases: ECGDatabase[]): Bucket[] =>
  group(databases, (db) => db.leads, (n) => plain(String(n)), 'key')

/** Megoszlás klinikai fókusz szerint (a leggyakoribb elöl). Az érték a PhysioNet angol szövege. */
export const byCategory = (databases: ECGDatabase[]): Bucket[] =>
  group(databases, (db) => db.category.trim() || null, (category) => plain(String(category)), 'count')

/** Rekordszám-sávok: tízes nagyságrendek szerint, hogy a 7 és a 45 152 rekord is látható legyen. */
export const RECORD_BANDS: Array<{ max: number; label: Text }> = [
  { max: 99, label: { hu: '100 alatt', en: 'under 100' } },
  { max: 999, label: { hu: '100–999', en: '100–999' } },
  { max: 9999, label: { hu: '1 000–9 999', en: '1,000–9,999' } },
  { max: Infinity, label: { hu: '10 000 vagy több', en: '10,000 or more' } },
]

export const byRecordBand = (databases: ECGDatabase[]): Bucket[] =>
  group(databases, (db) => (db.records === null ? null : RECORD_BANDS.findIndex((band) => db.records! <= band.max)), (index) => RECORD_BANDS[Number(index)].label, 'key')

/** Kitöltöttség: hány adatbázisnál hány mező van kitöltve a 16-ból (a legjobb elöl). */
export function byCompleteness(databases: ECGDatabase[]): Bucket[] {
  const groups = new Map<number, ECGDatabase[]>()
  for (const db of databases) {
    const { present } = getCompleteness(db)
    groups.set(present, [...(groups.get(present) ?? []), db])
  }
  const total = getCompleteness(databases[0] ?? ({} as ECGDatabase)).total
  return [...groups.entries()]
    .sort(([a], [b]) => b - a)
    .map(([present, dbs]) => ({ key: String(present), label: plain(`${present}/${total}`), count: dbs.length, names: dbs.map(shortName) }))
}

/** FAIR-ellenőrzésenként: hány adatbázisnál teljesül (a sorrend a definíciók sorrendje). */
export function byFairCheck(databases: ECGDatabase[]): Bucket[] {
  return fairDefinitions.flatMap((dimension) =>
    dimension.checks.map((check) => {
      const passing = databases.filter((db) => check.test(db))
      return {
        key: `${dimension.key}:${check.label.en}`,
        label: { hu: `${dimension.key} · ${check.label.hu}`, en: `${dimension.key} · ${check.label.en}` },
        count: passing.length,
        names: passing.map(shortName),
      }
    }),
  )
}

/** Összesítő számok az oldal tetejére. */
export function catalogTotals(databases: ECGDatabase[]) {
  const sum = (values: Array<number | null>) => values.reduce<number>((acc, value) => acc + (value ?? 0), 0)
  return {
    datasets: databases.length,
    records: sum(databases.map((db) => db.records)),
    subjects: sum(databases.map((db) => db.subject_count)),
    subjectsKnown: databases.filter((db) => db.subject_count !== null).length,
  }
}
