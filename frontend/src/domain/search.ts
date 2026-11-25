/**
 * Katalógus-keresés és szűrés (Database catalog oldal).
 *
 * A teljes katalógus egyszer töltődik le, és a böngésző szűr – 21 rekordnál ez
 * azonnali, és minden oldal ugyanazt a teljes adatot látja.
 */
import type { ECGDatabase } from './types.ts'
import { hasText } from './format.ts'
import { matchesAnnotation, type AnnotationFocus } from './matching.ts'

export type CatalogFilters = {
  search: string
  minFrequency: number
  category: string
  leads: string
  license: string
  annotation: AnnotationFocus | 'all'
  fileFormat: string
}

export const emptyCatalogFilters: CatalogFilters = {
  search: '',
  minFrequency: 0,
  category: 'all',
  leads: 'all',
  license: 'all',
  annotation: 'all',
  fileFormat: 'all',
}

export const LICENSE_NOT_RECORDED = 'Not recorded'
export const licenseName = (db: ECGDatabase): string => db.license || LICENSE_NOT_RECORDED

/** A szabad szöveges keresés ezekben a mezőkben keres. */
export function datasetSearchText(db: ECGDatabase): string {
  return [
    db.name, db.short_name, db.category, db.description, db.annotations, db.records_label,
    db.doi, db.source_database_id, db.version, db.file_format, db.license, db.access_conditions,
  ]
    .filter(hasText)
    .join(' ')
    .toLocaleLowerCase()
}

export function hasActiveFilters(filters: CatalogFilters): boolean {
  return JSON.stringify(filters) !== JSON.stringify(emptyCatalogFilters)
}

export function filterCatalog(databases: ECGDatabase[], filters: CatalogFilters): ECGDatabase[] {
  const query = filters.search.trim().toLocaleLowerCase()
  return databases.filter((db) => {
    if (query && !datasetSearchText(db).includes(query)) return false
    // Ismeretlen frekvencia nem felel meg egy minimum-feltételnek.
    if (filters.minFrequency > 0 && (db.frequency === null || db.frequency < filters.minFrequency)) return false
    if (filters.category !== 'all' && db.category !== filters.category) return false
    if (filters.leads !== 'all' && db.leads !== Number(filters.leads)) return false
    if (filters.license !== 'all' && licenseName(db) !== filters.license) return false
    if (filters.annotation !== 'all' && !matchesAnnotation(db, filters.annotation)) return false
    if (filters.fileFormat !== 'all' && (db.file_format ?? '').toLocaleLowerCase() !== filters.fileFormat.toLocaleLowerCase()) return false
    return true
  })
}

/** Rendezett, ismétlődés nélküli értéklista egy mezőből (a legördülő menükhöz). */
export function distinctValues<T extends string | number>(values: Array<T | null | undefined>): T[] {
  const unique = [...new Set(values.filter((value): value is T => value !== null && value !== undefined && value !== ''))]
  return unique.sort((a, b) => (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b))))
}

export type SortKey = 'name' | 'records' | 'subject_count' | 'frequency' | 'leads' | 'category'
export type SortState = { key: SortKey; direction: 'asc' | 'desc' }

/**
 * Rendezés egy oszlop szerint. A hiányzó érték (null) MINDIG a lista végére kerül,
 * irányától függetlenül – így egy „Not recorded” sosem tűnik a legkisebbnek vagy legnagyobbnak.
 */
export function sortCatalog(databases: ECGDatabase[], sort: SortState): ECGDatabase[] {
  const factor = sort.direction === 'asc' ? 1 : -1
  return [...databases].sort((a, b) => {
    const left = a[sort.key]
    const right = b[sort.key]
    if (left === null && right === null) return a.name.localeCompare(b.name)
    if (left === null) return 1
    if (right === null) return -1
    const result = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right))
    return result === 0 ? a.name.localeCompare(b.name) : result * factor
  })
}
