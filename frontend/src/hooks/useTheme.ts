/**
 * Világos / sötét mód.
 *
 * Első látogatáskor a rendszer beállítását követi (prefers-color-scheme), utána
 * a felhasználó választását a böngésző megjegyzi. A téma a <html data-theme="…">
 * attribútumon keresztül vált: a CSS-változók (styles/base.css) ehhez igazodnak.
 */
import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'
export const THEME_STORAGE_KEY = 'ekg-theme'

export function initialTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // A tárolás tiltva lehet; ilyenkor a rendszerbeállítás dönt.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Ha nem menthető, a választás csak az aktuális munkamenetre él.
    }
  }

  return { theme, toggleTheme }
}
