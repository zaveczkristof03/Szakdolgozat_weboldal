/** Gyorsszűrő gombok a katalógus tetején. Újrakattintásra a szűrés törlődik. */
import { applyQuickFilter, isQuickFilterActive, quickFilterCount, quickFilters } from '../../domain/quickFilters.ts'
import { emptyCatalogFilters, type CatalogFilters } from '../../domain/search.ts'
import type { ECGDatabase } from '../../domain/types.ts'
import { s } from '../../i18n/strings.ts'
import { useLang } from '../../i18n/useLang.ts'

type Props = { databases: ECGDatabase[]; filters: CatalogFilters; onChange: (filters: CatalogFilters) => void }

export default function QuickFilters({ databases, filters, onChange }: Props) {
  const { t } = useLang()
  return (
    <div className="quick-filters" role="group" aria-label={t(s.catalog.quickFilters)}>
      <span className="quick-filters-label">{t(s.catalog.quickFilters)}:</span>
      {quickFilters.map((quick) => {
        const active = isQuickFilterActive(quick, filters)
        return (
          <button
            key={quick.id}
            type="button"
            className="chip"
            aria-pressed={active}
            onClick={() => onChange(active ? emptyCatalogFilters : applyQuickFilter(quick))}
          >
            {t(quick.label)} <span className="chip-count">{quickFilterCount(databases, quick)}</span>
          </button>
        )
      })}
    </div>
  )
}
