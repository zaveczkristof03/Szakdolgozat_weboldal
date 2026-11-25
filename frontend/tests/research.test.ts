/**
 * A domain-réteg tesztjei (React és böngésző nélkül futnak: npm run test:domain).
 * Minden fontos szabályhoz tartozik legalább egy teszt.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addDatasetToCollection,
  catalogCsvRows,
  countFairChecks,
  csvEscape,
  datasetSearchText,
  emptyCatalogFilters,
  emptyFormValues,
  emptyResearchCriteria,
  evaluateComparison,
  filterCatalog,
  findResearchMatches,
  formToPayload,
  formValuesFrom,
  getCompleteness,
  getFairProfile,
  matchesAnnotation,
  MAX_COMPARE_DATASETS,
  parseCollections,
  toggleCompareSelection,
  type ECGDatabase,
  type ResearchCriteria,
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

const criteria: ResearchCriteria = {
  focus: 'atrial-fibrillation', leads: 2, minFrequency: 250, annotation: 'rhythm', fileFormat: 'WFDB', minRecords: 25, minSubjects: 20,
}

test('catalog search text includes identifiers and format, but not URLs', () => {
  const searchable = datasetSearchText(afdb)
  assert.match(searchable, /afdb/)
  assert.match(searchable, /wfdb/)
  assert.match(searchable, /10\.13026\/c2mw2d/)
  assert.doesNotMatch(searchable, /https:/)
})

test('Research Fit Finder includes a dataset when all documented requirements match, and says where the focus was found', () => {
  const result = findResearchMatches([afdb], criteria)
  assert.equal(result.matches.length, 1)
  assert.equal(result.matches[0].reasons.length, 7)
  assert.match(result.matches[0].reasons[0], /clinical focus: “Atrial fibrillation”/)
})

test('missing values never satisfy a requirement', () => {
  const unknown = { ...afdb, subject_count: null, frequency: null, leads: null }
  const result = findResearchMatches([unknown], criteria)
  assert.equal(result.matches.length, 0)
  const explanation = result.excluded[0].missingEvidence.join(' ')
  assert.match(explanation, /Subject count is not recorded/)
  assert.match(explanation, /Sampling frequency is not recorded/)
  assert.match(explanation, /number of ECG leads is not recorded/)
})

test('research focus is not inferred from URLs or descriptions', () => {
  const csn = { ...afdb, category: 'Clinical 12-lead ECG', annotations: 'Rhythm labels', name: 'Chapman-Shaoxing and Ningbo ECG Database',
    source_url: 'https://physionet.org/content/ecg-arrhythmia/1.0.0/', description: 'Arrhythmia study.' }
  const result = findResearchMatches([csn], { ...emptyResearchCriteria, focus: 'arrhythmia' })
  assert.equal(result.matches.length, 0)
})

test('ST/T focus does not match waveform-boundary annotations that only mention T waves', () => {
  const ludb = { ...afdb, category: 'ECG waveform delineation', annotations: 'Manual delineation of P, QRS and T waves', name: 'Lobachevsky University Electrocardiography Database' }
  assert.equal(findResearchMatches([ludb], { ...emptyResearchCriteria, focus: 'st-t' }).matches.length, 0)
  assert.equal(findResearchMatches([ludb], { ...emptyResearchCriteria, focus: 'waveform-delineation' }).matches.length, 1)
})

test('annotation matching ignores hyphens and never uses the clinical category', () => {
  assert.ok(matchesAnnotation({ ...afdb, annotations: 'Expert-reviewed beat, rhythm and signal-quality annotations' }, 'signal-quality'))
  assert.ok(!matchesAnnotation({ ...afdb, annotations: null }, 'rhythm'))
})

test('Research Fit Finder explains numeric and file-format mismatches', () => {
  const result = findResearchMatches([{ ...afdb, leads: 12, frequency: 128, file_format: 'CSV' }], criteria)
  const explanation = result.excluded[0].missingEvidence.join(' ')
  assert.match(explanation, /Requires 2 leads/)
  assert.match(explanation, /below the required 250 Hz/)
  assert.match(explanation, /required format is WFDB/)
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

test('saved research collections are deduplicated and invalid values are discarded', () => {
  const collections = parseCollections(JSON.stringify([{
    id: 'research-1', name: '  AF study  ', description: '  ', createdAt: 'not-a-date',
    datasetIds: [1, 1, 2, -5, 'invalid'], notes: { '1': 'Keep for review', '2': 42, invalid: 'x' },
  }, { id: 'broken' }]))
  assert.equal(collections.length, 1)
  assert.equal(collections[0].name, 'AF study')
  assert.deepEqual(collections[0].datasetIds, [1, 2])
  assert.deepEqual(collections[0].notes, { '1': 'Keep for review' })
  assert.deepEqual(parseCollections('{not json'), [])
})

test('saving to research creates a first collection and does not duplicate', () => {
  const first = addDatasetToCollection([], '', 7)
  assert.equal(first.collections.length, 1)
  assert.deepEqual(first.collections[0].datasetIds, [7])
  const again = addDatasetToCollection(first.collections, first.targetId, 7)
  assert.equal(again.alreadyPresent, true)
})

test('admin form keeps unknown values missing instead of inventing defaults', () => {
  const values = { ...emptyFormValues(), name: 'New dataset', category: 'Arrhythmia' }
  const { payload } = formToPayload(values)
  assert.equal(payload?.records, null)
  assert.equal(payload?.frequency, null)
  assert.equal(payload?.leads, null)
  assert.equal(payload?.last_verified, null)
  assert.match(formToPayload({ ...values, leads: '0' }).error ?? '', /leads must be a whole number of at least 1/)
  assert.deepEqual(formToPayload(formValuesFrom(afdb)).payload, (({ id: _id, ...rest }) => rest)(afdb))
})

test('hash routes round-trip and fall back to the catalog', () => {
  assert.deepEqual(parseHash('#/compare?dataset=12'), { page: 'compare', datasetId: 12 })
  assert.deepEqual(parseHash('#/unknown'), { page: 'catalog', datasetId: null })
  assert.equal(formatHash({ page: 'finder', datasetId: null }), '#/finder')
})
