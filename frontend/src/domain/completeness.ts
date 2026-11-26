/**
 * Metadata Completeness – mely mezők vannak kitöltve, és melyek hiányoznak.
 *
 * Fontos: ez a DOKUMENTÁLTSÁGOT méri, nem az EKG-jelek minőségét, és nem is
 * azt, hogy a kitöltött érték helyes-e (az a későbbi Quality Inspector feladata).
 * A rekordszám, a frekvencia és az elvezetésszám is része a mérésnek, mert
 * ezek most már valóban hiányozhatnak (korábban alapértéket kaptak).
 */
import type { Text } from '../i18n/lang.ts'
import type { ECGDatabase } from './types.ts'
import { hasText, text } from './format.ts'

export type CompletenessField = { key: keyof ECGDatabase; label: Text; group: Text; value: string }

export const completenessFields: Array<Omit<CompletenessField, 'value'>> = [
  { key: 'short_name', label: { hu: 'Rövid név', en: 'Short name' }, group: { hu: 'Azonosítás', en: 'Identification' } },
  { key: 'version', label: { hu: 'Verzió', en: 'Version' }, group: { hu: 'Azonosítás', en: 'Identification' } },
  { key: 'doi', label: { hu: 'DOI', en: 'DOI' }, group: { hu: 'Azonosítás', en: 'Identification' } },
  { key: 'source_database_id', label: { hu: 'Forrásazonosító', en: 'Source database ID' }, group: { hu: 'Azonosítás', en: 'Identification' } },
  { key: 'records', label: { hu: 'Rekordszám', en: 'Records' }, group: { hu: 'Méret', en: 'Dataset size' } },
  { key: 'records_label', label: { hu: 'Rekordleírás', en: 'Record description' }, group: { hu: 'Méret', en: 'Dataset size' } },
  { key: 'subject_count', label: { hu: 'Személyszám', en: 'Subject count' }, group: { hu: 'Méret', en: 'Dataset size' } },
  { key: 'frequency', label: { hu: 'Mintavételezési frekvencia', en: 'Sampling frequency' }, group: { hu: 'Jelstruktúra', en: 'Signal structure' } },
  { key: 'leads', label: { hu: 'Elvezetésszám', en: 'Number of ECG leads' }, group: { hu: 'Jelstruktúra', en: 'Signal structure' } },
  { key: 'duration', label: { hu: 'Felvételi időtartam', en: 'Recording duration' }, group: { hu: 'Jelstruktúra', en: 'Signal structure' } },
  { key: 'annotations', label: { hu: 'Annotációk', en: 'Annotations' }, group: { hu: 'Annotációk', en: 'Annotations' } },
  { key: 'file_format', label: { hu: 'Fájlformátum', en: 'File format' }, group: { hu: 'Technikai adatok', en: 'Technical' } },
  { key: 'license', label: { hu: 'Licenc', en: 'License' }, group: { hu: 'Hozzáférés és újrafelhasználás', en: 'Access & reuse' } },
  { key: 'access_conditions', label: { hu: 'Hozzáférési feltételek', en: 'Access conditions' }, group: { hu: 'Hozzáférés és újrafelhasználás', en: 'Access & reuse' } },
  { key: 'provenance_url', label: { hu: 'Eredetforrás (provenance)', en: 'Provenance URL' }, group: { hu: 'Forrás és ellenőrzés', en: 'Source & verification' } },
  { key: 'last_verified', label: { hu: 'Utolsó ellenőrzés', en: 'Last verified' }, group: { hu: 'Forrás és ellenőrzés', en: 'Source & verification' } },
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
