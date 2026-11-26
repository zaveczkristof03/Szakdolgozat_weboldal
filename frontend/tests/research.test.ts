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

import { layoutTrace } from '../src/domain/ecgTrace.ts'
import { canonicalLead, mapLeads } from '../src/domain/leads.ts'

test('EKG-papír lépték: 25 mm/s, 10 mm/mV, és a hiányzó minta megszakítja a vonalat', () => {
  const trace = layoutTrace([0, 1, null, 0.5], 4)
  assert.ok(trace)
  assert.equal(trace.widthMm, 25)
  assert.equal(trace.gainMmPerMv, 10)
  assert.equal(trace.heightMm, 15)
  assert.equal(trace.path.split('M').length - 1, 2)
  assert.match(trace.path, /^M0 12\.5L6\.25 2\.5M18\.75 7\.5$/)
})

test('EKG-papír: nagy kitérésnél a lépték feleződik, de a jel nem vágódik le', () => {
  const trace = layoutTrace([-3, 3], 2)
  assert.ok(trace)
  assert.equal(trace.gainMmPerMv, 5)
  assert.ok(trace.heightMm <= 40)
  assert.equal(layoutTrace([null, 1], 100), null)
})

test('Elvezetéstérkép: csak egyértelmű nevek kerülnek a térképre', () => {
  assert.equal(canonicalLead('MLII'), 'II')
  assert.equal(canonicalLead('avf'), 'AVF')
  assert.equal(canonicalLead('MV2'), 'V2')
  assert.equal(canonicalLead('ECG1'), null)
  assert.equal(canonicalLead('vx'), null)
  const map = mapLeads(['MLII', 'V5', 'ECG'])
  assert.deepEqual([...map.active].sort(), ['LL', 'RA', 'V5'])
  assert.deepEqual(map.unmapped, ['ECG'])
})

// ---------- Áttekintés oldal (domain/overview.ts) a valódi katalógusadatokon ----------
import { readFileSync } from 'node:fs'
import { byCategory, byCompleteness, byFairCheck, byFrequency, byLeads, byRecordBand, catalogTotals } from '../src/domain/overview.ts'

const catalog: ECGDatabase[] = JSON.parse(readFileSync(new URL('../../backend/data/catalog.json', import.meta.url), 'utf8'))
const sumCounts = (buckets: Array<{ count: number }>) => buckets.reduce((acc, bucket) => acc + bucket.count, 0)

test('overview: every distribution accounts for every dataset exactly once', () => {
  for (const buckets of [byFrequency(catalog), byLeads(catalog), byRecordBand(catalog), byCategory(catalog), byCompleteness(catalog)]) {
    assert.equal(sumCounts(buckets), catalog.length)
    assert.equal(new Set(buckets.flatMap((bucket) => bucket.names)).size, catalog.length)
  }
})

test('overview: a missing value gets its own last "Not recorded" group and is never guessed', () => {
  const sample = [afdb, { ...afdb, id: 2, short_name: 'X', frequency: null }, { ...afdb, id: 3, short_name: 'Y', frequency: 500 }]
  const buckets = byFrequency(sample)
  assert.deepEqual(buckets.map((bucket) => bucket.key), ['250', '500', 'missing'])
  assert.deepEqual(buckets[2].names, ['X'])
})

test('overview: numeric groups are in ascending order, categories by frequency', () => {
  const hz = byFrequency(catalog).map((bucket) => Number(bucket.key))
  assert.deepEqual(hz, [...hz].sort((a, b) => a - b))
  const counts = byCategory(catalog).map((bucket) => bucket.count)
  assert.deepEqual(counts, [...counts].sort((a, b) => b - a))
})

test('overview: record bands and totals match the catalog', () => {
  const bands = byRecordBand(catalog)
  assert.equal(bands.find((bucket) => bucket.key === '3')?.count, catalog.filter((db) => (db.records ?? 0) >= 10000).length)
  const totals = catalogTotals(catalog)
  assert.equal(totals.records, catalog.reduce((acc, db) => acc + (db.records ?? 0), 0))
  assert.equal(totals.subjectsKnown, catalog.filter((db) => db.subject_count !== null).length)
})

test('overview: one bar per FAIR check, counts never exceed the catalog size', () => {
  const checks = byFairCheck(catalog)
  assert.equal(checks.length, fairDefinitions.reduce((acc, dimension) => acc + dimension.checks.length, 0))
  assert.ok(checks.every((bucket) => bucket.count >= 0 && bucket.count <= catalog.length))
})
