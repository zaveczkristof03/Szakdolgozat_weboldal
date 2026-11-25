/** A katalógus keresője és szűrői. Az állapot a szülőben (CatalogPage) van. */
import { useMemo } from 'react'
import { datasetSearchText, distinctValues, emptyCatalogFilters, hasActiveFilters, licenseName, type CatalogFilters as Filters } from '../../domain/search.ts'
import { annotationRules, type AnnotationFocus } from '../../domain/matching.ts'
import { formatOptional } from '../../domain/format.ts'
import type { ECGDatabase } from '../../domain/types.ts'

type Props = { databases: ECGDatabase[]; filters: Filters; onChange: (filters: Filters) => void }

export default function CatalogFilters({ databases, filters, onChange }: Props) {
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => onChange({ ...filters, [key]: value })
  const categories = useMemo(() => distinctValues(databases.map((db) => db.category)), [databases])
  const leadOptions = useMemo(() => distinctValues(databases.map((db) => db.leads)), [databases])
  const licenses = useMemo(() => distinctValues(databases.map(licenseName)), [databases])
  const fileFormats = useMemo(() => distinctValues(databases.map((db) => db.file_format)), [databases])
  const frequencyOptions = useMemo(() => distinctValues(databases.map((db) => db.frequency)), [databases])

  const query = filters.search.trim().toLocaleLowerCase()
  const suggestions = query ? databases.filter((db) => datasetSearchText(db).includes(query)).slice(0, 6) : []

  return (
    <div className="filter-area">
      <div className="filter-main-row">
        <div className="search-container">
          <label className="search-box">
            <span className="search-icon" aria-hidden="true">⌕</span>
            <input
              value={filters.search}
              onChange={(event) => set('search', event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') set('search', '')
                if (event.key === 'Enter' && suggestions.length === 1) set('search', suggestions[0].name)
              }}
              placeholder="Search name, annotation, DOI or source ID…"
              aria-label="Search the catalog"
              role="combobox"
              aria-expanded={suggestions.length > 0}
              aria-controls="dataset-suggestions"
              aria-autocomplete="list"
            />
            {filters.search && (
              <button type="button" className="clear-search" onClick={() => set('search', '')} aria-label="Clear search">×</button>
            )}
          </label>

          {query && (
            <div id="dataset-suggestions" className="search-suggestions" role="listbox">
              {suggestions.length ? suggestions.map((db) => (
                <button type="button" className="suggestion-item" key={db.id} role="option" aria-selected={filters.search === db.name} onClick={() => set('search', db.name)}>
                  <span className="suggestion-name">{db.name}</span>
                  <span className="suggestion-details">
                    {formatOptional(db.records)} records · {formatOptional(db.frequency, 'Hz')} · {formatOptional(db.leads)} leads
                  </span>
                </button>
              )) : <div className="suggestion-empty">No catalog metadata matches “{filters.search.trim()}”.</div>}
            </div>
          )}
        </div>

        <label className="frequency-filter">
          <span>Minimum frequency</span>
          <select value={String(filters.minFrequency)} onChange={(event) => set('minFrequency', Number(event.target.value))}>
            <option value="0">Any frequency</option>
            {frequencyOptions.map((hz) => <option key={hz} value={hz}>{hz} Hz or more</option>)}
          </select>
        </label>
      </div>

      <div className="advanced-filters">
        <label className="filter-field">
          <span>Clinical focus</span>
          <select value={filters.category} onChange={(event) => set('category', event.target.value)}>
            <option value="all">All categories</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
        <label className="filter-field">
          <span>Number of leads</span>
          <select value={filters.leads} onChange={(event) => set('leads', event.target.value)}>
            <option value="all">All lead counts</option>
            {leadOptions.map((leads) => <option key={leads} value={String(leads)}>{leads} {leads === 1 ? 'lead' : 'leads'}</option>)}
          </select>
        </label>
        <label className="filter-field">
          <span>License</span>
          <select value={filters.license} onChange={(event) => set('license', event.target.value)}>
            <option value="all">All licenses</option>
            {licenses.map((license) => <option key={license} value={license}>{license}</option>)}
          </select>
        </label>
        <label className="filter-field">
          <span>Annotation type</span>
          <select value={filters.annotation} onChange={(event) => set('annotation', event.target.value as AnnotationFocus | 'all')}>
            <option value="all">No annotation filter</option>
            {(Object.keys(annotationRules) as Array<keyof typeof annotationRules>).map((key) => (
              <option key={key} value={key}>{annotationRules[key].label}</option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>File format</span>
          <select value={filters.fileFormat} onChange={(event) => set('fileFormat', event.target.value)}>
            <option value="all">Any recorded format</option>
            {fileFormats.map((format) => <option key={format} value={format}>{format}</option>)}
          </select>
        </label>
        <button className="reset-filters" type="button" onClick={() => onChange(emptyCatalogFilters)} disabled={!hasActiveFilters(filters)}>
          Reset filters
        </button>
      </div>
    </div>
  )
}
