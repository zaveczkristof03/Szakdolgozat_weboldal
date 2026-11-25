/**
 * Az admin űrlap logikája (React nélkül, ezért tesztelhető).
 *
 * Az űrlapon minden mező szöveg. Mentéskor:
 * - az üres mező `null` lesz (NEM 0, NEM 250 Hz, NEM mai dátum),
 * - a számmezőknek egész, nem negatív számnak kell lenniük,
 * - a név és a klinikai fókusz kötelező.
 */
import type { DatasetInput, ECGDatabase } from './types.ts'

export type DatasetFormValues = Record<keyof DatasetInput, string>

export const NUMBER_FIELDS = ['records', 'subject_count', 'frequency', 'leads'] as const
type NumberField = (typeof NUMBER_FIELDS)[number]

export const formSections: Array<{ title: string; fields: Array<{ key: keyof DatasetInput; label: string; type?: 'number' | 'url' | 'date' | 'textarea'; required?: boolean; hint?: string }> }> = [
  {
    title: 'Identification',
    fields: [
      { key: 'name', label: 'Dataset name', required: true },
      { key: 'short_name', label: 'Short name', hint: 'e.g. MITDB' },
      { key: 'version', label: 'Version', hint: 'e.g. 1.0.0' },
      { key: 'doi', label: 'DOI', hint: '10.13026/…' },
      { key: 'source_database_id', label: 'Source database ID', hint: 'e.g. mitdb/1.0.0' },
    ],
  },
  {
    title: 'Size and signal structure',
    fields: [
      { key: 'records', label: 'Records', type: 'number', hint: 'Number of recordings' },
      { key: 'records_label', label: 'What is a record?', hint: 'e.g. Half-hour two-channel ECG recordings' },
      { key: 'subject_count', label: 'Subjects', type: 'number', hint: 'Number of people, not recordings' },
      { key: 'frequency', label: 'Sampling frequency (Hz)', type: 'number' },
      { key: 'leads', label: 'Number of ECG leads', type: 'number' },
      { key: 'duration', label: 'Recording duration' },
    ],
  },
  {
    title: 'Content',
    fields: [
      { key: 'category', label: 'Clinical focus', required: true },
      { key: 'annotations', label: 'Annotations' },
      { key: 'file_format', label: 'File format', hint: 'e.g. WFDB' },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  {
    title: 'Access, source and verification',
    fields: [
      { key: 'license', label: 'License' },
      { key: 'access_conditions', label: 'Access conditions' },
      { key: 'source_url', label: 'Official source URL', type: 'url' },
      { key: 'provenance_url', label: 'Provenance URL', type: 'url' },
      { key: 'lightwave_database_id', label: 'LightWAVE database ID', hint: 'Only if “Visualize waveforms” exists on the PhysioNet page' },
      { key: 'last_verified', label: 'Last verified', type: 'date', hint: 'Leave empty unless you checked the source' },
    ],
  },
]

const ALL_KEYS = formSections.flatMap((section) => section.fields.map((field) => field.key))

export function emptyFormValues(): DatasetFormValues {
  return Object.fromEntries(ALL_KEYS.map((key) => [key, ''])) as DatasetFormValues
}

export function formValuesFrom(db: ECGDatabase): DatasetFormValues {
  return Object.fromEntries(ALL_KEYS.map((key) => [key, db[key] === null || db[key] === undefined ? '' : String(db[key])])) as DatasetFormValues
}

export function formToPayload(values: DatasetFormValues): { payload: DatasetInput | null; error: string | null } {
  if (!values.name.trim() || !values.category.trim()) return { payload: null, error: 'Dataset name and clinical focus are required.' }

  const numbers: Partial<Record<NumberField, number | null>> = {}
  for (const key of NUMBER_FIELDS) {
    const raw = values[key].trim()
    if (!raw) {
      numbers[key] = null
      continue
    }
    const value = Number(raw)
    const minimum = key === 'frequency' || key === 'leads' ? 1 : 0
    if (!Number.isInteger(value) || value < minimum) {
      return { payload: null, error: `${key.replace('_', ' ')} must be a whole number of at least ${minimum}, or left empty if unknown.` }
    }
    numbers[key] = value
  }

  const optional = (key: keyof DatasetInput) => values[key].trim() || null
  return {
    error: null,
    payload: {
      name: values.name.trim(),
      short_name: optional('short_name'),
      records: numbers.records ?? null,
      records_label: optional('records_label'),
      subject_count: numbers.subject_count ?? null,
      frequency: numbers.frequency ?? null,
      leads: numbers.leads ?? null,
      category: values.category.trim(),
      duration: optional('duration'),
      annotations: optional('annotations'),
      file_format: optional('file_format'),
      version: optional('version'),
      doi: optional('doi'),
      source_database_id: optional('source_database_id'),
      source_url: values.source_url.trim(),
      provenance_url: optional('provenance_url'),
      license: optional('license'),
      access_conditions: optional('access_conditions'),
      lightwave_database_id: optional('lightwave_database_id'),
      last_verified: optional('last_verified'),
      description: values.description.trim(),
    },
  }
}
