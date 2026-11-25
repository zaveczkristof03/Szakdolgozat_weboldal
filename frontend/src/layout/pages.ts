/** Az oldalak címei (menü, morzsamenü, oldalcím). */
import type { Page } from '../hooks/useHashRoute.ts'

export const pageTitles: Record<Page, string> = {
  catalog: 'Database catalog',
  finder: 'Research Fit Finder',
  compare: 'Compare datasets',
  quality: 'Metadata quality',
  statistics: 'Statistics',
  research: 'My Research',
}
