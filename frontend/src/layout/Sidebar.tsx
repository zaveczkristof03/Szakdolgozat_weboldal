/** Bal oldali navigáció. Az aktív oldal az URL-ből jön (lásd useHashRoute). */
import type { Page } from '../hooks/useHashRoute.ts'
import { pageTitles } from './pages.ts'

const navSymbols: Record<Page, string> = {
  catalog: '▤', finder: '⌕', compare: '⇄', quality: '▦', statistics: '▥', research: '◇',
}

type Props = { activePage: Page; apiStatus: string; compareCount: number; onNavigate: (page: Page) => void }

export default function Sidebar({ activePage, apiStatus, compareCount, onNavigate }: Props) {
  return (
    <aside className="sidebar">
      <a className="brand" href="#/catalog">
        <span className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 36 36" role="img"><path d="M4 19h7l4-9 6 17 4-10h7" /></svg>
        </span>
        <span>EKG <strong>Explorer</strong></span>
      </a>

      {/* taste-skill-ignore: functional navigation group label, not a decorative eyebrow. */}
      <div className="sidebar-group-label">Workspace</div>

      <nav className="main-nav" aria-label="Main navigation">
        {(Object.keys(pageTitles) as Page[]).map((page) => (
          <button
            key={page}
            type="button"
            className={`nav-item ${activePage === page ? 'active' : ''}`}
            aria-current={activePage === page ? 'page' : undefined}
            onClick={() => onNavigate(page)}
          >
            <span className="nav-symbol" aria-hidden="true">{navSymbols[page]}</span>
            <span>{pageTitles[page]}</span>
            {page === 'compare' && compareCount > 0 && <span className="nav-count" aria-label={`${compareCount} selected`}>{compareCount}</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className={`connection-mark ${apiStatus === 'Connected' ? 'is-connected' : ''}`} />
        <div>
          <strong>{apiStatus}</strong>
          <span>Metadata API</span>
        </div>
        <span className="sidebar-version">v0.8</span>
      </div>
    </aside>
  )
}
