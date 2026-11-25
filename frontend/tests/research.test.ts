/**
 * A domain-réteg tesztjei (React és böngésző nélkül futnak: npm run test:domain).
 * Minden fontos szabályhoz tartozik legalább egy teszt.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  catalogCsvRows,
  countFairChecks,
  csvEscape,
  datasetSearchText,
  emptyCatalogFilters,
  evaluateComparison,
  filterCatalog,
  getCompleteness,
  getFairProfile,
  matchesAnnotation,
  MAX_COMPARE_DATASETS,
  sortCatalog,
  toggleCompareSelection,
  type ECGDatabase,
} from '../src/domain/research.ts'
import { formatHash, parseHash } from '../src/hooks/useHashRoute.ts'

const afdb: ECGDatabase = {
  id: 1,
  name: 'MIT-BIH Atrial Fibrillation Database',
  short_name: 'AFDB',
  records: 25,
  records_label: 'Long-term ECG recordings',
  subject_count: 23,
  frequency: 250,
  leads: 2,
  category: 'Atrial fibrillation',
  duration: '10 hours per recording',
  annotations: 'Rhythm annotations',
  file_format: 'WFDB',
  version: '1.0.0',
  doi: '10.13026/C2MW2D',
  source_database_id: 'afdb/1.0.0',
  source_url: 'https://physionet.org/content/afdb/1.0.0/',
  provenance_url: 'https://physionet.org/content/afdb/1.0.0/',
  license: 'Open Data Commons Attribution License v1.0',
  access_conditions: 'Open access.',
  lightwave_database_id: 'afdb/1.0.0',
  last_verified: '2026-11-12',
  description: 'Long-term ECG recordings from subjects with atrial fibrillation.',
}

test('catalog search text includes identifiers and format, but not URLs', () => {
  const searchable = datasetSearchText(afdb)
  assert.match(searchable, /afdb/)
  assert.match(searchable, /wfdb/)
  assert.match(searchable, /10\.13026\/c2mw2d/)
  assert.doesNotMatch(searchable, /https:/)
})

test('annotation matching ignores hyphens and never uses the clinical category', () => {
  assert.ok(matchesAnnotation({ ...afdb, annotations: 'Expert-reviewed beat, rhythm and signal-quality annotations' }, 'signal-quality'))
  assert.ok(!matchesAnnotation({ ...afdb, annotations: null }, 'rhythm'))
})

test('sorting keeps missing values last in both directions', () => {
  const data = [{ ...afdb, id: 1, name: 'A', frequency: null }, { ...afdb, id: 2, name: 'B', frequency: 500 }, { ...afdb, id: 3, name: 'C', frequency: 128 }]
  assert.deepEqual(sortCatalog(data, { key: 'frequency', direction: 'asc' }).map((db) => db.id), [3, 2, 1])
  assert.deepEqual(sortCatalog(data, { key: 'frequency', direction: 'desc' }).map((db) => db.id), [2, 3, 1])
})

test('catalog filter treats an unknown frequency as not meeting a minimum', () => {
  const filtered = filterCatalog([afdb, { ...afdb, id: 2, frequency: null }], { ...emptyCatalogFilters, minFrequency: 250 })
  assert.deepEqual(filtered.map((db) => db.id), [1])
})

test('metadata completeness includes the core numeric fields', () => {
  const profile = getCompleteness({ ...afdb, subject_count: null, frequency: null })
  assert.equal(profile.total, 16)
  assert.equal(profile.present, 14)
  assert.deepEqual(profile.missing.map((field) => field.label), ['Subject count', 'Sampling frequency'])
})

test('FAIR checks are counted, not scored, and react to real documentation gaps', () => {
  const complete = countFairChecks(afdb)
  assert.equal(complete.documented, complete.total)
  const partial = getFairProfile({ ...afdb, doi: 'not-a-doi', subject_count: null })
  assert.equal(partial.find((dimension) => dimension.key === 'F')?.documented, 2)
  assert.equal(partial.find((dimension) => dimension.key === 'R')?.documented, 4)
  assert.ok(partial.every((dimension) => !('percent' in dimension)))
})

test('comparison marks key differences and can hide missing rows', () => {
  const other = { ...afdb, id: 2, frequency: 500, doi: null }
  const rows = evaluateComparison([afdb, other], { differencesOnly: true, showMissing: true })
  const frequency = rows.find((row) => row.label === 'Sampling frequency')
  assert.ok(frequency?.different && frequency.key)
  assert.equal(evaluateComparison([afdb, other], { differencesOnly: false, showMissing: false }).some((row) => row.label === 'DOI'), false)
})

test('comparison selection never exceeds the four-dataset limit', () => {
  assert.equal(MAX_COMPARE_DATASETS, 4)
  const blocked = toggleCompareSelection([1, 2, 3, 4], 5)
  assert.equal(blocked.limitReached, true)
  assert.deepEqual(blocked.ids, [1, 2, 3, 4])
  assert.deepEqual(toggleCompareSelection([1, 2, 3, 4], 2).ids, [1, 3, 4])
})

test('CSV export escapes quotes, neutralizes formulas and keeps missing values empty', () => {
  assert.equal(csvEscape('A "quoted" value'), '"A ""quoted"" value"')
  assert.equal(csvEscape('=HYPERLINK("https://example.com")'), `"'=HYPERLINK(""https://example.com"")"`)
  assert.equal(csvEscape('  =1+1'), `"'  =1+1"`)
  assert.equal(csvEscape(-5), '"-5"')
  const rows = catalogCsvRows([{ ...afdb, subject_count: null }])
  assert.equal(rows[1][rows[0].indexOf('subject_count')], '')
})

test('hash routes round-trip and fall back to the catalog', () => {
  assert.deepEqual(parseHash('#/compare?dataset=12'), { page: 'compare', datasetId: 12 })
  assert.deepEqual(parseHash('#/unknown'), { page: 'catalog', datasetId: null })
  assert.equal(formatHash({ page: 'methodology', datasetId: null }), '#/methodology')
  assert.deepEqual(parseHash('#/finder'), { page: 'catalog', datasetId: null })
})
