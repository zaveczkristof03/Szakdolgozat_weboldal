/**
 * Gyorsszűrők: a leggyakoribb kutatási kérdések egy kattintással.
 *
 * Mindegyik csak a meglévő szűrőket állítja be (nincs külön logika), így a
 * találatok pontosan ugyanazok, mintha a felhasználó kézzel választotta volna
 * ki a bal oldali szűrőket. A gomb mellett a találatok száma látszik.
 */
import type { Text } from '../i18n/lang.ts'
import { emptyCatalogFilters, filterCatalog, type CatalogFilters } from './search.ts'
import type { ECGDatabase } from './types.ts'

export type QuickFilter = { id: string; label: Text; filters: Partial<CatalogFilters> }

export const quickFilters: QuickFilter[] = [
  { id: 'twelve-lead', label: { hu: '12 elvezetéses', en: '12-lead' }, filters: { leads: '12' } },
  { id: 'atrial-fibrillation', label: { hu: 'Pitvarfibrilláció', en: 'Atrial fibrillation' }, filters: { category: 'Atrial fibrillation' } },
  { id: 'high-rate', label: { hu: 'Legalább 500 Hz', en: '500 Hz or more' }, filters: { minFrequency: 500 } },
  { id: 'beat', label: { hu: 'Szívütés-annotációval', en: 'With beat annotations' }, filters: { annotation: 'beat' } },
  { id: 'waveform', label: { hu: 'Hullámhatár-annotációval', en: 'With waveform delineation' }, filters: { annotation: 'waveform' } },
]

export const applyQuickFilter = (quick: QuickFilter): CatalogFilters => ({ ...emptyCatalogFilters, ...quick.filters })

/** Akkor aktív, ha a jelenlegi szűrés pontosan ez a gyorsszűrő (semmi más nincs beállítva). */
export const isQuickFilterActive = (quick: QuickFilter, filters: CatalogFilters): boolean =>
  JSON.stringify(applyQuickFilter(quick)) === JSON.stringify(filters)

export const quickFilterCount = (databases: ECGDatabase[], quick: QuickFilter): number =>
  filterCatalog(databases, applyQuickFilter(quick)).length
