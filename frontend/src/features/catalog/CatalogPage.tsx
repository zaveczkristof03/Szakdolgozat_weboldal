/**
 * Katalógus oldal: bal oldalt a szűrők, jobb oldalt a találatok táblázata.
 *
 * - Egy sorra (az adatbázis nevére) kattintva megnyílik az adatlap.
 * - Az első oszlop jelölőnégyzetével lehet összehasonlításra kijelölni (max. 4).
 * - Az oszlopfejlécre kattintva lehet rendezni.
 * Adat: a teljes katalógus (props). Szűrés és rendezés: domain/search.ts.
 */
import { useMemo, useState } from 'react'
import { emptyCatalogFilters, filterCatalog, sortCatalog, type CatalogFilters as Filters, type SortKey, type SortState } from '../../domain/search.ts'
import { MAX_COMPARE_DATASETS } from '../../domain/compare.ts'
import { getCompleteness } from '../../domain/completeness.ts'
import { catalogCsvRows, datedFilename, downloadCsv } from '../../domain/csv.ts'
import type { ECGDatabase } from '../../domain/types.ts'
import Value from '../../components/Value.tsx'
import CatalogFilters from './CatalogFilters.tsx'

type Props = {
  databases: ECGDatabase[]
  compareIds: number[]
  onOpen: (id: number) => void
  onToggleCompare: (id: number) => void
}

const columns: Array<{ key: SortKey; label: string; numeric?: boolean }> = [
  { key: 'name', label: 'Dataset' },
  { key: 'records', label: 'Records', numeric: true },
  { key: 'subject_count', label: 'Subjects', numeric: true },
  { key: 'frequency', label: 'Sampling rate', numeric: true },
  { key: 'leads', label: 'Leads', numeric: true },
  { key: 'category', label: 'Clinical focus' },
]

export default function CatalogPage({ databases, compareIds, onOpen, onToggleCompare }: Props) {
  const [filters, setFilters] = useState<Filters>(emptyCatalogFilters)
  const [sort, setSort] = useState<SortState>({ key: 'name', direction: 'asc' })
  const rows = useMemo(() => sortCatalog(filterCatalog(databases, filters), sort), [databases, filters, sort])
  const compareFull = compareIds.length >= MAX_COMPARE_DATASETS

  const sortBy = (key: SortKey) =>
    setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }))

  return (
    <div className="catalog-layout">
      <aside className="catalog-sidebar" aria-label="Filters">
        <CatalogFilters databases={databases} filters={filters} onChange={setFilters} />
      </aside>

      <section className="catalog-results" aria-labelledby="results-heading">
        <div className="results-bar">
          <h1 id="results-heading" className="results-heading">
            {rows.length === databases.length ? `${databases.length} ECG datasets` : `${rows.length} of ${databases.length} datasets`}
          </h1>
          <div className="results-actions">
            {compareIds.length > 0 && <a className="button" href="#/compare">Compare selected ({compareIds.length})</a>}
            <button type="button" className="button button-quiet" onClick={() => downloadCsv(datedFilename('ekg-datasets'), catalogCsvRows(rows))} disabled={!rows.length}>
              Export CSV
            </button>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-select"><span className="visually-hidden">Compare</span></th>
                {columns.map((column) => {
                  const active = sort.key === column.key
                  return (
                    <th key={column.key} className={column.numeric ? 'numeric' : undefined} aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}>
                      <button type="button" className="sort-button" onClick={() => sortBy(column.key)}>
                        {column.label}
                        <span className="sort-mark" aria-hidden="true">{active ? (sort.direction === 'asc' ? '↑' : '↓') : ''}</span>
                      </button>
                    </th>
                  )
                })}
                <th className="numeric" title="Assessed metadata fields recorded in the catalog">Documented</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((db) => {
                const selected = compareIds.includes(db.id)
                const completeness = getCompleteness(db)
                return (
                  <tr key={db.id} className={selected ? 'is-selected' : undefined}>
                    <td className="col-select">
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={!selected && compareFull}
                        onChange={() => onToggleCompare(db.id)}
                        aria-label={`Select ${db.name} for comparison`}
                        title={!selected && compareFull ? `Up to ${MAX_COMPARE_DATASETS} datasets can be compared` : 'Select for comparison'}
                      />
                    </td>
                    <td>
                      <button type="button" className="dataset-link" onClick={() => onOpen(db.id)}>{db.name}</button>
                      {db.short_name && <span className="dataset-code">{db.short_name}</span>}
                    </td>
                    <td className="numeric"><Value value={db.records} /></td>
                    <td className="numeric"><Value value={db.subject_count} /></td>
                    <td className="numeric"><Value value={db.frequency} unit="Hz" /></td>
                    <td className="numeric"><Value value={db.leads} /></td>
                    <td>{db.category}</td>
                    <td className="numeric">{completeness.present}/{completeness.total}</td>
                  </tr>
                )
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={columns.length + 2} className="empty-row">
                    No dataset matches these filters.{' '}
                    <button type="button" className="link-button" onClick={() => setFilters(emptyCatalogFilters)}>Clear filters</button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="footnote">
          Records and subjects are different quantities: one subject can contribute several records.
          “Not recorded” means the catalog has no verified value. It is never replaced by an estimate.
          See <a href="#/methodology">Methodology</a> for how “Documented” is counted.
        </p>
      </section>
    </div>
  )
}
