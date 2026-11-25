/**
 * Research Fit Finder oldal. A szabályok a domain/finder.ts és domain/matching.ts
 * fájlokban vannak; ez a komponens csak a feltételeket és az indoklást jeleníti meg.
 */
import { useMemo, useState } from 'react'
import { countActiveCriteria, emptyResearchCriteria, findResearchMatches, type ResearchCriteria } from '../../domain/finder.ts'
import { MAX_COMPARE_DATASETS } from '../../domain/compare.ts'
import { distinctValues } from '../../domain/search.ts'
import { formatOptional } from '../../domain/format.ts'
import type { ECGDatabase } from '../../domain/types.ts'

type Props = {
  databases: ECGDatabase[]
  onOpen: (id: number) => void
  onCompare: (id: number) => void
  onSave: (id: number) => void
  compareIds: number[]
}

const initialCriteria: ResearchCriteria = emptyResearchCriteria

const focusOptions = [
  { value: 'any', label: 'Any research area' },
  { value: 'atrial-fibrillation', label: 'Atrial fibrillation' },
  { value: 'arrhythmia', label: 'Arrhythmia' },
  { value: 'st-t', label: 'ST / T-wave analysis' },
  { value: 'normal-sinus', label: 'Normal sinus rhythm' },
  { value: 'waveform-delineation', label: 'Waveform delineation' },
  { value: 'signal-quality', label: 'Signal quality and noise' },
  { value: 'clinical-diagnostic', label: 'Clinical diagnostic ECG' },
] as const

const annotationOptions = [
  { value: 'any', label: 'No annotation requirement' },
  { value: 'beat', label: 'Beat annotations' },
  { value: 'rhythm', label: 'Rhythm annotations' },
  { value: 'st', label: 'ST annotations' },
  { value: 'waveform', label: 'Waveform delineation' },
  { value: 'diagnostic', label: 'Diagnostic labels' },
  { value: 'signal-quality', label: 'Signal quality / noise' },
] as const

export default function ResearchFinder({ databases, onOpen, onCompare, onSave, compareIds }: Props) {
  const [criteria, setCriteria] = useState<ResearchCriteria>(initialCriteria)
  const [showExcluded, setShowExcluded] = useState(false)
  const results = useMemo(
    () => findResearchMatches(databases, criteria),
    [databases, criteria],
  )
  const activeCriteria = countActiveCriteria(criteria)
  const leadOptions = useMemo(() => distinctValues(databases.map((db) => db.leads)), [databases])
  const frequencyOptions = useMemo(() => distinctValues(databases.map((db) => db.frequency)), [databases])
  const fileFormats = useMemo(() => distinctValues(databases.map((db) => db.file_format)), [databases])

  const update = <K extends keyof ResearchCriteria>(key: K, value: ResearchCriteria[K]) => {
    setCriteria((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="feature-page">
      <section className="feature-intro">
        <div className="finder-count" aria-live="polite">
          <strong>{results.matches.length}</strong>
          <span>matching datasets</span>
        </div>
      </section>

      <section className="panel research-criteria-panel">
        <div className="feature-panel-heading">
          <div>
            <h3>Research requirements</h3>
            <p>{activeCriteria} of {Object.keys(emptyResearchCriteria).length} optional constraints selected. Unselected criteria do not restrict results.</p>
          </div>
          <button type="button" className="text-button" onClick={() => setCriteria(initialCriteria)} disabled={activeCriteria === 0}>
            Clear criteria
          </button>
        </div>
        <div className="criteria-grid">
          <label className="filter-field">
            <span>Research focus</span>
            <select value={criteria.focus} onChange={(event) => update('focus', event.target.value as ResearchCriteria['focus'])}>
              {focusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="filter-field">
            <span>ECG leads</span>
            <select value={criteria.leads === null ? 'any' : String(criteria.leads)} onChange={(event) => update('leads', event.target.value === 'any' ? null : Number(event.target.value))}>
              <option value="any">Any lead count</option>
              {leadOptions.map((leads) => <option key={leads} value={leads}>{leads} {leads === 1 ? 'lead' : 'leads'}</option>)}
            </select>
          </label>
          <label className="filter-field">
            <span>Minimum sampling frequency</span>
            <select value={String(criteria.minFrequency)} onChange={(event) => update('minFrequency', Number(event.target.value))}>
              <option value="0">Any frequency</option>
              {frequencyOptions.map((hz) => <option key={hz} value={hz}>{hz} Hz or higher</option>)}
            </select>
          </label>
          <label className="filter-field">
            <span>Annotation requirement</span>
            <select value={criteria.annotation} onChange={(event) => update('annotation', event.target.value as ResearchCriteria['annotation'])}>
              {annotationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="filter-field">
            <span>File format</span>
            <select value={criteria.fileFormat} onChange={(event) => update('fileFormat', event.target.value)}>
              <option value="any">Any recorded format</option>
              {fileFormats.map((format) => <option key={format} value={format}>{format}</option>)}
            </select>
          </label>
          <label className="filter-field">
            <span>Minimum number of records</span>
            <select value={criteria.minRecords === null ? 'any' : String(criteria.minRecords)} onChange={(event) => update('minRecords', event.target.value === 'any' ? null : Number(event.target.value))}>
              <option value="any">No minimum</option>
              <option value="25">25 records</option>
              <option value="100">100 records</option>
              <option value="500">500 records</option>
              <option value="1000">1,000 records</option>
              <option value="10000">10,000 records</option>
            </select>
          </label>
          <label className="filter-field">
            <span>Minimum number of subjects</span>
            <select value={criteria.minSubjects === null ? 'any' : String(criteria.minSubjects)} onChange={(event) => update('minSubjects', event.target.value === 'any' ? null : Number(event.target.value))}>
              <option value="any">No minimum</option>
              <option value="20">20 subjects</option>
              <option value="50">50 subjects</option>
              <option value="100">100 subjects</option>
              <option value="500">500 subjects</option>
              <option value="1000">1,000 subjects</option>
              <option value="10000">10,000 subjects</option>
            </select>
          </label>
        </div>
        <div className="criteria-footnote">
          This is a metadata-based filter, not a clinical recommendation. A dataset is included only when its recorded fields satisfy every selected condition.
        </div>
      </section>

      <section className="panel finder-results-panel">
        <div className="feature-panel-heading">
          <div>
            <h3>Datasets matching your requirements</h3>
            <p>Matches are not ranked. Each result shows the evidence that satisfied your criteria.</p>
          </div>
          <span className="result-count">{results.matches.length} / {databases.length}</span>
        </div>
        {results.matches.length ? (
          <div className="finder-result-list">
            {results.matches.map(({ dataset, reasons }) => (
              <article className="finder-result" key={dataset.id}>
                <div className="finder-result-main">
                  <div className="finder-result-titleline">
                    <button type="button" className="dataset-detail-trigger" onClick={() => onOpen(dataset.id)}>{dataset.name}</button>
                    {dataset.short_name && <span className="mono-label">{dataset.short_name}</span>}
                  </div>
                  <div className="finder-facts">
                    <span>{formatOptional(dataset.records)} records</span>
                    <span>{dataset.subject_count === null ? 'subjects not recorded' : `${formatOptional(dataset.subject_count)} subjects`}</span>
                    <span>{formatOptional(dataset.frequency, 'Hz')}</span>
                    <span>{formatOptional(dataset.leads)} leads</span>
                    <span>{dataset.file_format || 'Format not recorded'}</span>
                  </div>
                  <ul className="match-reasons">
                    {reasons.length ? reasons.map((reason) => <li key={reason}>{reason}</li>) : <li>All selected fields were satisfied; no additional constraints were applied.</li>}
                  </ul>
                </div>
                <div className="finder-result-actions">
                  <button type="button" className="text-button" onClick={() => onSave(dataset.id)}>Save</button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => onCompare(dataset.id)}
                    disabled={compareIds.includes(dataset.id) || compareIds.length >= MAX_COMPARE_DATASETS}
                  >
                    {compareIds.includes(dataset.id) ? 'In comparison' : compareIds.length >= MAX_COMPARE_DATASETS ? 'Limit reached' : 'Compare'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="feature-empty-state">
            <strong>No datasets meet all selected conditions.</strong>
            <span>Remove one requirement or choose a broader research focus. Missing metadata is not treated as a match.</span>
            <button type="button" className="text-button" onClick={() => setCriteria(initialCriteria)}>Clear all requirements</button>
          </div>
        )}
        {results.excluded.length > 0 && (
          <div className="excluded-section">
            <button type="button" className="disclosure-button" aria-expanded={showExcluded} onClick={() => setShowExcluded((value) => !value)}>
              <span>{showExcluded ? 'Hide' : 'Show'} {results.excluded.length} excluded datasets</span>
              <span>{showExcluded ? '−' : '+'}</span>
            </button>
            {showExcluded && (
              <div className="excluded-list">
                {results.excluded.map(({ dataset, missingEvidence }) => (
                  <div className="excluded-row" key={dataset.id}>
                    <span>{dataset.name}</span>
                    <span>{missingEvidence.length ? missingEvidence.join(' ') : 'One or more selected requirements were not met.'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
