/** A katalógus keresője és szűrői (bal oldali oszlop). Az állapot a szülőben (CatalogPage) van. */
import { useMemo } from 'react'
import { distinctValues, emptyCatalogFilters, hasActiveFilters, LICENSE_NOT_RECORDED, licenseName, type CatalogFilters as Filters } from '../../domain/search.ts'
import { annotationRules, type AnnotationFocus } from '../../domain/matching.ts'
import type { ECGDatabase } from '../../domain/types.ts'
import { NOT_RECORDED } from '../../domain/format.ts'
import { s } from '../../i18n/strings.ts'
import { useLang } from '../../i18n/useLang.ts'

type Props = { databases: ECGDatabase[]; filters: Filters; onChange: (filters: Filters) => void }

export default function CatalogFilters({ databases, filters, onChange }: Props) {
  const { t } = useLang()
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => onChange({ ...filters, [key]: value })
  const categories = useMemo(() => distinctValues(databases.map((db) => db.category)), [databases])
  const leadOptions = useMemo(() => distinctValues(databases.map((db) => db.leads)), [databases])
  const licenses = useMemo(() => distinctValues(databases.map(licenseName)), [databases])
  const fileFormats = useMemo(() => distinctValues(databases.map((db) => db.file_format)), [databases])
  const frequencyOptions = useMemo(() => distinctValues(databases.map((db) => db.frequency)), [databases])

  return (
    <form className="filters" role="search" onSubmit={(event) => event.preventDefault()}>
      <label className="field">
        <span className="field-label">{t(s.filters.search)}</span>
        <input
          type="search"
          value={filters.search}
          onChange={(event) => set('search', event.target.value)}
          placeholder={t(s.filters.searchPlaceholder)}
        />
      </label>

      <label className="field">
        <span className="field-label">{t(s.filters.category)}</span>
        <select value={filters.category} onChange={(event) => set('category', event.target.value)}>
          <option value="all">{t(s.filters.any)}</option>
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
      </label>

      <label className="field">
        <span className="field-label">{t(s.filters.annotation)}</span>
        <select value={filters.annotation} onChange={(event) => set('annotation', event.target.value as AnnotationFocus | 'all')}>
          <option value="all">{t(s.filters.any)}</option>
          {(Object.keys(annotationRules) as Array<keyof typeof annotationRules>).map((key) => (
            <option key={key} value={key}>{t(annotationRules[key].label)}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field-label">{t(s.filters.leads)}</span>
        <select value={filters.leads} onChange={(event) => set('leads', event.target.value)}>
          <option value="all">{t(s.filters.any)}</option>
          {leadOptions.map((leads) => <option key={leads} value={String(leads)}>{leads}</option>)}
        </select>
      </label>

      <label className="field">
        <span className="field-label">{t(s.filters.minFrequency)}</span>
        <select value={String(filters.minFrequency)} onChange={(event) => set('minFrequency', Number(event.target.value))}>
          <option value="0">{t(s.filters.any)}</option>
          {frequencyOptions.map((hz) => <option key={hz} value={hz}>{hz} Hz</option>)}
        </select>
      </label>

      <label className="field">
        <span className="field-label">{t(s.filters.fileFormat)}</span>
        <select value={filters.fileFormat} onChange={(event) => set('fileFormat', event.target.value)}>
          <option value="all">{t(s.filters.any)}</option>
          {fileFormats.map((format) => <option key={format} value={format}>{format}</option>)}
        </select>
      </label>

      <label className="field">
        <span className="field-label">{t(s.filters.license)}</span>
        <select value={filters.license} onChange={(event) => set('license', event.target.value)}>
          <option value="all">{t(s.filters.any)}</option>
          {licenses.map((license) => <option key={license} value={license}>{license === LICENSE_NOT_RECORDED ? t(NOT_RECORDED) : license}</option>)}
        </select>
      </label>

      <button type="button" className="link-button" onClick={() => onChange(emptyCatalogFilters)} disabled={!hasActiveFilters(filters)}>
        {t(s.filters.clearAll)}
      </button>
    </form>
  )
}
