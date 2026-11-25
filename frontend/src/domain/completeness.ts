/**
 * Metadata Completeness – mely mezők vannak kitöltve, és melyek hiányoznak.
 *
 * Fontos: ez a DOKUMENTÁLTSÁGOT méri, nem az EKG-jelek minőségét, és nem is
 * azt, hogy a kitöltött érték helyes-e (az a későbbi Quality Inspector feladata).
 * A rekordszám, a frekvencia és az elvezetésszám is része a mérésnek, mert
 * ezek most már valóban hiányozhatnak (korábban alapértéket kaptak).
 */
import type { ECGDatabase } from './types.ts'
import { hasText, text } from './format.ts'

export type CompletenessField = { key: keyof ECGDatabase; label: string; group: string; value: string }

export const completenessFields: Array<Omit<CompletenessField, 'value'>> = [
  { key: 'short_name', label: 'Short name', group: 'Identification' },
  { key: 'version', label: 'Version', group: 'Identification' },
  { key: 'doi', label: 'DOI', group: 'Identification' },
  { key: 'source_database_id', label: 'Source database ID', group: 'Identification' },
  { key: 'records', label: 'Records', group: 'Dataset size' },
  { key: 'records_label', label: 'Record description', group: 'Dataset size' },
  { key: 'subject_count', label: 'Subject count', group: 'Dataset size' },
  { key: 'frequency', label: 'Sampling frequency', group: 'Signal structure' },
  { key: 'leads', label: 'Number of ECG leads', group: 'Signal structure' },
  { key: 'duration', label: 'Recording duration', group: 'Signal structure' },
  { key: 'annotations', label: 'Annotations', group: 'Annotations' },
  { key: 'file_format', label: 'File format', group: 'Technical' },
  { key: 'license', label: 'License', group: 'Access & reuse' },
  { key: 'access_conditions', label: 'Access conditions', group: 'Access & reuse' },
  { key: 'provenance_url', label: 'Provenance URL', group: 'Source & verification' },
  { key: 'last_verified', label: 'Last verified', group: 'Source & verification' },
]

export type Completeness = {
  percent: number
  present: number
  total: number
  fields: CompletenessField[]
  missing: CompletenessField[]
}

export function getCompleteness(db: ECGDatabase): Completeness {
  const fields = completenessFields.map((field) => ({ ...field, value: text(db[field.key]) }))
  const present = fields.filter((field) => hasText(db[field.key])).length
  const total = fields.length
  return {
    percent: total ? Math.round((present / total) * 100) : 0,
    present,
    total,
    fields,
    missing: fields.filter((field) => !field.value),
  }
}
