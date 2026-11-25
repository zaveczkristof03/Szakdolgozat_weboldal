/**
 * Advanced Compare – legfeljebb 4 adatbázis összehasonlítása.
 *
 * A sorok listája itt van, nem a komponensben, így a CSV-export és a táblázat
 * ugyanazt használja, és tesztelhető.
 */
import type { ECGDatabase } from './types.ts'
import { formatNumber, hasText } from './format.ts'

export const MAX_COMPARE_DATASETS = 4

export function toggleCompareSelection(current: number[], datasetId: number): { ids: number[]; limitReached: boolean } {
  if (current.includes(datasetId)) return { ids: current.filter((id) => id !== datasetId), limitReached: false }
  if (current.length >= MAX_COMPARE_DATASETS) return { ids: current, limitReached: true }
  return { ids: [...current, datasetId], limitReached: false }
}

export type ComparisonRow = {
  group: string
  label: string
  value: (db: ECGDatabase) => string | null
  /** Kulcsfontosságú eltérés: a kutatási alkalmasságot közvetlenül befolyásolja. */
  key?: boolean
}

const optionalNumber = (value: number | null, unit = '') => (value === null ? null : `${formatNumber(value)}${unit}`)

export const comparisonRows: ComparisonRow[] = [
  { group: 'Identification', label: 'Short name', value: (db) => db.short_name },
  { group: 'Identification', label: 'Version', value: (db) => db.version },
  { group: 'Identification', label: 'DOI', value: (db) => db.doi },
  { group: 'Identification', label: 'Source database ID', value: (db) => db.source_database_id },
  { group: 'Dataset size', label: 'Records', value: (db) => optionalNumber(db.records), key: true },
  { group: 'Dataset size', label: 'Subjects', value: (db) => optionalNumber(db.subject_count), key: true },
  { group: 'Dataset size', label: 'Record description', value: (db) => db.records_label },
  { group: 'Signal structure', label: 'Sampling frequency', value: (db) => optionalNumber(db.frequency, ' Hz'), key: true },
  { group: 'Signal structure', label: 'Number of ECG leads', value: (db) => optionalNumber(db.leads), key: true },
  { group: 'Signal structure', label: 'Recording duration', value: (db) => db.duration },
  { group: 'Annotations', label: 'Annotation types', value: (db) => db.annotations, key: true },
  { group: 'Technical', label: 'File format', value: (db) => db.file_format, key: true },
  { group: 'Access & reuse', label: 'License', value: (db) => db.license, key: true },
  { group: 'Access & reuse', label: 'Access conditions', value: (db) => db.access_conditions },
  { group: 'Source & verification', label: 'Last verified', value: (db) => db.last_verified },
  { group: 'Source & verification', label: 'Official source URL', value: (db) => db.source_url || null },
  { group: 'Source & verification', label: 'Provenance URL', value: (db) => db.provenance_url },
  { group: 'Visualization', label: 'LightWAVE database ID', value: (db) => db.lightwave_database_id },
]

const isMissing = (value: string | null) => !hasText(value)

export type EvaluatedRow = ComparisonRow & { values: Array<string | null>; different: boolean; missing: boolean }

export function evaluateComparison(databases: ECGDatabase[], options: { differencesOnly: boolean; showMissing: boolean }): EvaluatedRow[] {
  return comparisonRows
    .map((row) => {
      const values = databases.map(row.value)
      const normalized = values.map((value) => (isMissing(value) ? '__missing__' : String(value).trim().toLocaleLowerCase()))
      return { ...row, values, different: new Set(normalized).size > 1, missing: values.some(isMissing) }
    })
    .filter((row) => (!options.differencesOnly || row.different) && (options.showMissing || !row.missing))
}
