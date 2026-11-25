/**
 * Felső fejléc: az oldal neve, a három menüpont és a nyelvváltó (HU / EN).
 * Az aktív menüpontot és nyelvet az `aria-current` / `aria-pressed` jelzi (képernyőolvasónak is).
 */
import { PAGES, type Page } from '../hooks/useHashRoute.ts'
import { LANGS } from '../i18n/lang.ts'
import { s } from '../i18n/strings.ts'
import { useLang } from '../i18n/useLang.ts'

type Props = { activePage: Page; compareCount: number }

export default function Header({ activePage, compareCount }: Props) {
  const { lang, setLang, t } = useLang()
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a className="site-title" href="#/catalog">{t(s.app.title)}</a>
        <nav aria-label={t(s.app.mainMenu)}>
          <ul className="site-nav">
            {PAGES.map((page) => (
              <li key={page}>
                <a href={`#/${page}`} aria-current={page === activePage ? 'page' : undefined}>
                  {t(s.app.pages[page])}
                  {page === 'compare' && compareCount > 0 && <span className="nav-count">{compareCount}</span>}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="lang-switch" role="group" aria-label={t(s.app.language)}>
          {LANGS.map((code) => (
            <button key={code} type="button" aria-pressed={lang === code} onClick={() => setLang(code)} lang={code}>
              {code.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}
