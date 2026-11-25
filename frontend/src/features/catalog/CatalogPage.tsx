/**
 * Katalógus oldal: bal oldalt a szűrők, jobb oldalt a találatok táblázata.
 *
 * - Egy sorra (az adatbázis nevére) kattintva megnyílik az adatlap.
 * - Az első oszlop jelölőnégyzetével lehet összehasonlításra kijelölni (max. 4).
 * - Az oszlopfejlécre kattintva lehet rendezni.
 * Adat: a teljes katalógus (props). Szűrés és rendezés: domain/search.ts.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { emptyCatalogFilters, filterCatalog, sortCatalog, type CatalogFilters as Filters, type SortKey, type SortState } from '../../domain/search.ts'
import { MAX_COMPARE_DATASETS } from '../../domain/compare.ts'
import { getCompleteness } from '../../domain/completeness.ts'
import { catalogCsvRows, datedFilename, downloadCsv } from '../../domain/csv.ts'
import type { ECGDatabase } from '../../domain/types.ts'
import Value from '../../components/Value.tsx'
import { s } from '../../i18n/strings.ts'
import { useLang } from '../../i18n/useLang.ts'
import CatalogFilters from './CatalogFilters.tsx'
import QuickFilters from './QuickFilters.tsx'

type Props = {
  databases: ECGDatabase[]
  compareIds: number[]
  onOpen: (id: number) => void
  onToggleCompare: (id: number) => void
  /** Nagy képernyőn a harmadik oszlop tartalma (adatlap vagy áttekintés); kisebb képernyőn null. */
  panel: ReactNode
  openId: number | null
}

const columns: Array<{ key: SortKey; numeric?: boolean }> = [
  { key: 'name' },
  { key: 'records', numeric: true },
  { key: 'subject_count', numeric: true },
  { key: 'frequency', numeric: true },
  { key: 'leads', numeric: true },
  { key: 'category' },
]

export default function CatalogPage({ databases, compareIds, onOpen, onToggleCompare, panel, openId }: Props) {
  const { t } = useLang()
  const [filters, setFilters] = useState<Filters>(emptyCatalogFilters)
  const [sort, setSort] = useState<SortState>({ key: 'name', direction: 'asc' })
  const rows = useMemo(() => sortCatalog(filterCatalog(databases, filters), sort), [databases, filters, sort])
  const compareFull = compareIds.length >= MAX_COMPARE_DATASETS

  const sortBy = (key: SortKey) =>
    setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }))

  return (
    <div className={`catalog-layout${panel ? ' has-panel' : ''}`}>
      <aside className="catalog-sidebar" aria-label={t(s.catalog.filters)}>
        <CatalogFilters databases={databases} filters={filters} onChange={setFilters} />
      </aside>

      <section className="catalog-results" aria-labelledby="results-heading">
        <div className="results-bar">
          <h1 id="results-heading" className="results-heading">
            {t(rows.length === databases.length ? s.catalog.allCount(databases.length) : s.catalog.filteredCount(rows.length, databases.length))}
          </h1>
          <div className="results-actions">
            {compareIds.length > 0 && <a className="button" href="#/compare">{t(s.catalog.compareSelected(compareIds.length))}</a>}
            <button type="button" className="button button-quiet" onClick={() => downloadCsv(datedFilename('ekg-datasets'), catalogCsvRows(rows))} disabled={!rows.length}>
              {t(s.catalog.exportCsv)}
            </button>
          </div>
        </div>

        <QuickFilters databases={databases} filters={filters} onChange={setFilters} />

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-select"><span className="visually-hidden">{t(s.catalog.compareColumn)}</span></th>
                {columns.map((column) => {
                  const active = sort.key === column.key
                  return (
                    <th key={column.key} className={column.numeric ? 'numeric' : undefined} aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}>
                      <button type="button" className="sort-button" onClick={() => sortBy(column.key)}>
                        {t(s.catalog.columns[column.key])}
                        <span className="sort-mark" aria-hidden="true">{active ? (sort.direction === 'asc' ? '↑' : '↓') : ''}</span>
                      </button>
                    </th>
                  )
                })}
                <th className="numeric" title={t(s.catalog.documentedHint)}>{t(s.catalog.documented)}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((db) => {
                const selected = compareIds.includes(db.id)
                const completeness = getCompleteness(db)
                return (
                  <tr key={db.id} className={[selected ? 'is-selected' : '', openId === db.id ? 'is-open' : ''].join(' ').trim() || undefined}>
                    <td className="col-select">
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={!selected && compareFull}
                        onChange={() => onToggleCompare(db.id)}
                        aria-label={t(s.catalog.selectFor(db.name))}
                        title={t(!selected && compareFull ? s.catalog.limitHint(MAX_COMPARE_DATASETS) : s.catalog.selectHint)}
                      />
                    </td>
                    <td>
                      <button type="button" className="dataset-link" onClick={() => onOpen(db.id)} aria-current={openId === db.id ? 'true' : undefined}>{db.name}</button>
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
                    {t(s.catalog.noMatch)}{' '}
                    <button type="button" className="link-button" onClick={() => setFilters(emptyCatalogFilters)}>{t(s.catalog.clearFilters)}</button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="footnote">
          {t(s.catalog.footnote1)} {t(s.catalog.footnote2)} <a href="#/methodology">{t(s.app.pages.methodology)}</a> {t(s.catalog.footnote3)}
        </p>
      </section>

      {panel && <aside className="catalog-panel">{panel}</aside>}
    </div>
  )
}
