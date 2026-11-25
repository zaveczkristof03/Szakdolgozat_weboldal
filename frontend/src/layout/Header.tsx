/**
 * Felső fejléc: az oldal neve és a három menüpont.
 * Az aktív menüpontot az `aria-current` jelzi (képernyőolvasónak is).
 */
import { PAGES, type Page } from '../hooks/useHashRoute.ts'
import { pageTitles } from './pages.ts'

type Props = { activePage: Page; compareCount: number }

export default function Header({ activePage, compareCount }: Props) {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a className="site-title" href="#/catalog">EKG MetaData Explorer</a>
        <nav aria-label="Main">
          <ul className="site-nav">
            {PAGES.map((page) => (
              <li key={page}>
                <a href={`#/${page}`} aria-current={page === activePage ? 'page' : undefined}>
                  {pageTitles[page]}
                  {page === 'compare' && compareCount > 0 && <span className="nav-count">{compareCount}</span>}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  )
}
