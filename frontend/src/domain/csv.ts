/**
 * CSV-export. Minden cella idézőjelek közé kerül; a képletnek látszó cellák
 * (=, +, -, @ kezdetű) elé aposztróf kerül, hogy egy táblázatkezelő ne futtassa őket.
 */
import type { ECGDatabase } from './types.ts'

const FORMULA_START = /^[\s]*[=+\-@]/

export function csvEscape(value: unknown): string {
  const rawText = value === null || value === undefined ? '' : String(value)
  const safeText = typeof value !== 'number' && FORMULA_START.test(rawText) ? `'${rawText}` : rawText
  return `"${safeText.replace(/"/g, '""')}"`
}

export function toCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map(csvEscape).join(',')).join('\r\n')
}

export function downloadCsv(filename: string, rows: unknown[][]): void {
  const blob = new Blob(['﻿', toCsv(rows)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** A katalógusexport oszlopai: a mezőnév mellett egyértelmű, angol fejléccel. */
export const catalogCsvColumns: Array<{ key: keyof ECGDatabase; label: string }> = [
  { key: 'id', label: 'id' },
  { key: 'name', label: 'dataset_name' },
  { key: 'short_name', label: 'short_name' },
  { key: 'records', label: 'records' },
  { key: 'records_label', label: 'records_label' },
  { key: 'subject_count', label: 'subject_count' },
  { key: 'frequency', label: 'sampling_frequency_hz' },
  { key: 'leads', label: 'ecg_leads' },
  { key: 'category', label: 'clinical_focus' },
  { key: 'duration', label: 'duration' },
  { key: 'annotations', label: 'annotations' },
  { key: 'file_format', label: 'file_format' },
  { key: 'version', label: 'version' },
  { key: 'doi', label: 'doi' },
  { key: 'source_database_id', label: 'source_database_id' },
  { key: 'source_url', label: 'official_source_url' },
  { key: 'provenance_url', label: 'provenance_url' },
  { key: 'license', label: 'license' },
  { key: 'access_conditions', label: 'access_conditions' },
  { key: 'lightwave_database_id', label: 'lightwave_database_id' },
  { key: 'last_verified', label: 'last_verified' },
  { key: 'description', label: 'description' },
]

export function catalogCsvRows(databases: ECGDatabase[]): unknown[][] {
  return [catalogCsvColumns.map((column) => column.label), ...databases.map((db) => catalogCsvColumns.map((column) => db[column.key] ?? ''))]
}

export const datedFilename = (prefix: string) => `${prefix}-${new Date().toISOString().slice(0, 10)}.csv`
