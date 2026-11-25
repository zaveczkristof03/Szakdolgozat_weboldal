/** Az oldalak neve a felső menüben. */
import type { Page } from '../hooks/useHashRoute.ts'

export const pageTitles: Record<Page, string> = {
  catalog: 'Catalog',
  compare: 'Compare',
  methodology: 'Methodology',
}
