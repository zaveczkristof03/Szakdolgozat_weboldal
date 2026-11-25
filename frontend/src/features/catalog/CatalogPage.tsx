/**
 * Database catalog oldal: összefoglaló sáv, kereső/szűrők, adattábla, CSV-export.
 *
 * Adat: a teljes katalógus (props). Szűrés: domain/search.ts → filterCatalog.
 */
import { useMemo, useState } from 'react'
import { emptyCatalogFilters, filterCatalog, licenseName, type CatalogFilters as Filters } from '../../domain/search.ts'
import { MAX_COMPARE_DATASETS } from '../../domain/compare.ts'
import { catalogCsvRows, datedFilename, downloadCsv } from '../../domain/csv.ts'
import type { ECGDatabase } from '../../domain/types.ts'
import Value from '../../components/Value.tsx'
import CatalogFilters from './CatalogFilters.tsx'

type Props = {
  databases: ECGDatabase[]
  compareIds: number[]
  isAdmin: boolean
  onOpen: (id: number) => void
  onToggleCompare: (id: number) => void
  onSave: (id: number) => void
  onCreate: () => void
  onEdit: (db: ECGDatabase) => void
  onDelete: (db: ECGDatabase) => void
}

export default function CatalogPage({ databases, compareIds, isAdmin, onOpen, onToggleCompare, onSave, onCreate, onEdit, onDelete }: Props) {
  const [filters, setFilters] = useState<Filters>(emptyCatalogFilters)
  const filtered = useMemo(() => filterCatalog(databases, filters), [databases, filters])
  const knownFrequencies = filtered.map((db) => db.frequency).filter((hz): hz is number => hz !== null)
  const leadConfigurations = [...new Set(filtered.map((db) => db.leads).filter((leads): leads is number => leads !== null))].sort((a, b) => a - b)
  const compareFull = compareIds.length >= MAX_COMPARE_DATASETS
  const columnCount = isAdmin ? 9 : 8

  return (
    <>
      <section className="catalog-summary" aria-label="Filtered catalog summary">
        <div className="summary-item">
          <span>Datasets in view</span>
          <strong>{filtered.length}<small> / {databases.length}</small></strong>
        </div>
        <div className="summary-item">
          <span>Lead configurations</span>
          <strong>{leadConfigurations.length ? leadConfigurations.join(', ') : '—'}<small>{leadConfigurations.length ? ' leads' : ''}</small></strong>
        </div>
        <div className="summary-item">
          <span>Sampling rates in view</span>
          <strong>
            {knownFrequencies.length ? <>{Math.min(...knownFrequencies)}–{Math.max(...knownFrequencies)}<small> Hz</small></> : '—'}
          </strong>
        </div>
      </section>

      <section className="panel catalog-panel">
        <div className="panel-heading">
          <div>
            <h2>ECG database catalog</h2>
            <p>Search by dataset name, then narrow results with metadata filters.</p>
            {!isAdmin && <span className="read-only-note">Read-only public catalog</span>}
          </div>
          <div className="catalog-actions">
            <span className="result-count">{filtered.length} {filtered.length === 1 ? 'dataset' : 'datasets'}</span>
            {isAdmin && <button type="button" className="primary-action-button" onClick={onCreate}>＋ New dataset</button>}
            <button type="button" className="export-button" onClick={() => downloadCsv(datedFilename('ekg-datasets'), catalogCsvRows(filtered))} disabled={!filtered.length}>
              ↓ Export CSV
            </button>
          </div>
        </div>

        <CatalogFilters databases={databases} filters={filters} onChange={setFilters} />

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Dataset</th>
                <th className="numeric">Records*</th>
                <th className="numeric">Subjects</th>
                <th className="numeric">Sampling rate</th>
                <th className="numeric">Leads</th>
                <th>Clinical focus</th>
                <th>Compare</th>
                <th>Research list</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((db) => {
                const selected = compareIds.includes(db.id)
                return (
                  <tr key={db.id}>
                    <td>
                      <button type="button" className="dataset-detail-trigger" onClick={() => onOpen(db.id)}>
                        {db.name}<span aria-hidden="true"> ⓘ</span>
                      </button>
                      <small className="table-subtitle">{db.short_name ?? 'ECG dataset'} · {licenseName(db)}</small>
                    </td>
                    <td className="numeric"><Value value={db.records} /></td>
                    <td className="numeric"><Value value={db.subject_count} /></td>
                    <td className="numeric"><Value value={db.frequency} unit="Hz" /></td>
                    <td className="numeric"><Value value={db.leads} /></td>
                    <td><span className="category-value">{db.category}</span></td>
                    <td>
                      <button
                        type="button"
                        className={`compare-toggle ${selected ? 'selected' : ''}`}
                        onClick={() => onToggleCompare(db.id)}
                        disabled={!selected && compareFull}
                        aria-pressed={selected}
                      >
                        {selected ? 'Added' : compareFull ? 'Limit reached' : 'Add +'}
                      </button>
                    </td>
                    <td>
                      <button type="button" className="text-button save-research-button" onClick={() => onSave(db.id)} aria-label={`Save ${db.name} to My Research`}>
                        Save +
                      </button>
                    </td>
                    {isAdmin && (
                      <td>
                        <div className="row-actions">
                          <button type="button" className="row-edit-button" onClick={() => onEdit(db)} aria-label={`Edit ${db.name}`}>Edit</button>
                          <button type="button" className="row-delete-button" onClick={() => onDelete(db)} aria-label={`Delete ${db.name}`}>Delete</button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
              {!filtered.length && (
                <tr>
                  <td colSpan={columnCount} className="empty-state">
                    <strong>No matching datasets</strong>
                    <span>Try a different name or reset the filters.</span>
                    <button type="button" className="text-button" onClick={() => setFilters(emptyCatalogFilters)}>Reset all filters</button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="panel-footnote">
          * Records and subjects are different quantities: one subject can contribute several records.
          “Not recorded” means the catalog has no verified value; it is never replaced by an estimate.
        </div>
      </section>
    </>
  )
}
