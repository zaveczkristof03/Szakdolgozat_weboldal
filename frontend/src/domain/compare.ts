/**
 * Advanced Compare – legfeljebb 4 adatbázis összehasonlítása.
 *
 * A sorok listája itt van, nem a komponensben, így a CSV-export és a táblázat
 * ugyanazt használja, és tesztelhető.
 */
import type { Lang, Text } from '../i18n/lang.ts'
import type { ECGDatabase } from './types.ts'
import { formatNumber, hasText } from './format.ts'

export const MAX_COMPARE_DATASETS = 4

export function toggleCompareSelection(current: number[], datasetId: number): { ids: number[]; limitReached: boolean } {
  if (current.includes(datasetId)) return { ids: current.filter((id) => id !== datasetId), limitReached: false }
  if (current.length >= MAX_COMPARE_DATASETS) return { ids: current, limitReached: true }
  return { ids: [...current, datasetId], limitReached: false }
}

export type ComparisonRow = {
  group: Text
  label: Text
  value: (db: ECGDatabase, lang: Lang) => string | null
  /** Kulcsfontosságú eltérés: a kutatási alkalmasságot közvetlenül befolyásolja. */
  key?: boolean
}

const optionalNumber = (value: number | null, lang: Lang, unit = '') => (value === null ? null : `${formatNumber(value, lang)}${unit}`)

export const comparisonRows: ComparisonRow[] = [
  { group: { hu: 'Azonosítás', en: 'Identification' }, label: { hu: 'Rövid név', en: 'Short name' }, value: (db) => db.short_name },
  { group: { hu: 'Azonosítás', en: 'Identification' }, label: { hu: 'Verzió', en: 'Version' }, value: (db) => db.version },
  { group: { hu: 'Azonosítás', en: 'Identification' }, label: { hu: 'DOI', en: 'DOI' }, value: (db) => db.doi },
  { group: { hu: 'Azonosítás', en: 'Identification' }, label: { hu: 'Forrásazonosító', en: 'Source database ID' }, value: (db) => db.source_database_id },
  { group: { hu: 'Méret', en: 'Dataset size' }, label: { hu: 'Rekordszám', en: 'Records' }, value: (db, lang) => optionalNumber(db.records, lang), key: true },
  { group: { hu: 'Méret', en: 'Dataset size' }, label: { hu: 'Személyszám', en: 'Subject count' }, value: (db, lang) => optionalNumber(db.subject_count, lang), key: true },
  { group: { hu: 'Méret', en: 'Dataset size' }, label: { hu: 'Rekordleírás', en: 'Record description' }, value: (db) => db.records_label },
  { group: { hu: 'Jelstruktúra', en: 'Signal structure' }, label: { hu: 'Mintavételezés', en: 'Sampling frequency' }, value: (db, lang) => optionalNumber(db.frequency, lang, ' Hz'), key: true },
  { group: { hu: 'Jelstruktúra', en: 'Signal structure' }, label: { hu: 'Elvezetésszám', en: 'Number of ECG leads' }, value: (db, lang) => optionalNumber(db.leads, lang), key: true },
  { group: { hu: 'Jelstruktúra', en: 'Signal structure' }, label: { hu: 'Felvételi időtartam', en: 'Recording duration' }, value: (db) => db.duration },
  { group: { hu: 'Annotációk', en: 'Annotations' }, label: { hu: 'Annotációtípusok', en: 'Annotation types' }, value: (db) => db.annotations, key: true },
  { group: { hu: 'Technikai adatok', en: 'Technical' }, label: { hu: 'Fájlformátum', en: 'File format' }, value: (db) => db.file_format, key: true },
  { group: { hu: 'Hozzáférés', en: 'Access & reuse' }, label: { hu: 'Licenc', en: 'License' }, value: (db) => db.license, key: true },
  { group: { hu: 'Hozzáférés', en: 'Access & reuse' }, label: { hu: 'Hozzáférési feltételek', en: 'Access conditions' }, value: (db) => db.access_conditions },
  { group: { hu: 'Forrás és ellenőrzés', en: 'Source & verification' }, label: { hu: 'Utolsó ellenőrzés', en: 'Last verified' }, value: (db) => db.last_verified },
  { group: { hu: 'Forrás és ellenőrzés', en: 'Source & verification' }, label: { hu: 'Hivatalos forrás', en: 'Official source URL' }, value: (db) => db.source_url || null },
  { group: { hu: 'Forrás és ellenőrzés', en: 'Source & verification' }, label: { hu: 'Eredetforrás', en: 'Provenance URL' }, value: (db) => db.provenance_url },
  { group: { hu: 'Megjelenítés', en: 'Visualization' }, label: { hu: 'LightWAVE-azonosító', en: 'LightWAVE database ID' }, value: (db) => db.lightwave_database_id },
]

const isMissing = (value: string | null) => !hasText(value)

export type EvaluatedRow = ComparisonRow & { values: Array<string | null>; different: boolean; missing: boolean }

export function evaluateComparison(databases: ECGDatabase[], options: { differencesOnly: boolean; showMissing: boolean }, lang: Lang = 'hu'): EvaluatedRow[] {
  return comparisonRows
    .map((row) => {
      const values = databases.map((db) => row.value(db, lang))
      const normalized = values.map((value) => (isMissing(value) ? '__missing__' : String(value).trim().toLocaleLowerCase()))
      return { ...row, values, different: new Set(normalized).size > 1, missing: values.some(isMissing) }
    })
    .filter((row) => (!options.differencesOnly || row.different) && (options.showMissing || !row.missing))
}
