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
import { formatOptional } from '../src/domain/format.ts'
import { completenessFields } from '../src/domain/completeness.ts'
import { comparisonRows } from '../src/domain/compare.ts'
import { fairDefinitions } from '../src/domain/fair.ts'
import { parseLang } from '../src/i18n/lang.ts'
import { chooseDatasets, emptyChooserAnswers, evaluateChoice } from '../src/domain/chooser.ts'
import { applyQuickFilter, isQuickFilterActive, quickFilters } from '../src/domain/quickFilters.ts'

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
  assert.deepEqual(profile.missing.map((field) => field.label.hu), ['Személyszám', 'Mintavételezési frekvencia'])
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
  const frequency = rows.find((row) => row.label.hu === 'Mintavételezés')
  assert.ok(frequency?.different && frequency.key)
  assert.equal(evaluateComparison([afdb, other], { differencesOnly: false, showMissing: false }).some((row) => row.label.en === 'DOI'), false)
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

test('missing values and numbers are shown in the selected language', () => {
  assert.equal(formatOptional(null, '', 'hu'), 'Nincs adat')
  assert.equal(formatOptional(null, '', 'en'), 'Not recorded')
  assert.equal(formatOptional(45152, '', 'en'), '45,152')
  assert.equal(parseLang('en'), 'en')
  assert.equal(parseLang('de'), 'hu')
  assert.equal(parseLang(null), 'hu')
})

test('every field, comparison row and FAIR check has both a Hungarian and an English label', () => {
  const labels = [
    ...completenessFields.flatMap((field) => [field.label, field.group]),
    ...comparisonRows.flatMap((row) => [row.label, row.group]),
    ...fairDefinitions.flatMap((dimension) => [dimension.name, ...dimension.checks.flatMap((check) => [check.label, check.evidence])]),
  ]
  for (const label of labels) {
    assert.ok(label.hu.trim() && label.en.trim(), JSON.stringify(label))
  }
})

test('quick filters only set existing filters and are recognised as active', () => {
  const twelveLead = quickFilters.find((quick) => quick.id === 'twelve-lead')!
  const filters = applyQuickFilter(twelveLead)
  assert.deepEqual(filters, { ...emptyCatalogFilters, leads: '12' })
  assert.ok(isQuickFilterActive(twelveLead, filters))
  assert.ok(!isQuickFilterActive(twelveLead, { ...filters, search: 'ptb' }))
  assert.deepEqual(filterCatalog([afdb, { ...afdb, id: 2, leads: 12 }], filters).map((db) => db.id), [2])
})

test('chooser: a dataset fits only when every requirement is met, with a reason for each', () => {
  const answers = { ...emptyChooserAnswers, area: 'atrial-fibrillation' as const, leads: 'two-plus' as const, minFrequency: 250, annotation: 'rhythm' as const }
  const result = evaluateChoice(afdb, answers)
  assert.equal(result.fits, true)
  assert.equal(result.criteria.length, 4)
  assert.match(result.criteria[0].detail.hu, /Atrial fibrillation/)
  const twelve = evaluateChoice(afdb, { ...answers, leads: 'twelve-plus' })
  assert.equal(twelve.fits, false)
  assert.equal(twelve.criteria.find((c) => c.label.en === 'Leads')?.status, 'unmet')
})

test('chooser: a missing value is "cannot be checked" and never counts as met', () => {
  const unknown = evaluateChoice({ ...afdb, frequency: null, leads: null }, { ...emptyChooserAnswers, minFrequency: 250, leads: 'two-plus' })
  assert.equal(unknown.fits, false)
  assert.deepEqual(unknown.criteria.map((c) => c.status), ['unknown', 'unknown'])
})

test('chooser: research area is read from the clinical focus only', () => {
  const ludb = { ...afdb, id: 3, category: 'ECG waveform delineation', annotations: 'Rhythm annotations' }
  const { fits, others } = chooseDatasets([afdb, ludb], { ...emptyChooserAnswers, area: 'atrial-fibrillation' })
  assert.deepEqual(fits.map((r) => r.db.id), [1])
  assert.deepEqual(others.map((r) => r.db.id), [3])
})
