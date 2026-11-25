/**
 * Egyszerű, URL-alapú navigáció a címsor # utáni részével.
 *
 * Példák:  #/catalog   #/compare   #/catalog?dataset=12
 * Miért kell? Így működik a böngésző Vissza gombja, frissítés után ugyanott
 * maradunk, és egy adatlapra linket lehet küldeni. Külső router-könyvtár nem kell.
 */
import { useCallback, useEffect, useState } from 'react'

export const PAGES = ['catalog', 'compare', 'methodology'] as const
export type Page = (typeof PAGES)[number]

export type Route = { page: Page; datasetId: number | null }

export function parseHash(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?')
  const page = (PAGES as readonly string[]).includes(path) ? (path as Page) : 'catalog'
  const rawId = new URLSearchParams(query).get('dataset')
  const datasetId = rawId && /^\d+$/.test(rawId) ? Number(rawId) : null
  return { page, datasetId }
}

export function formatHash(route: Route): string {
  return `#/${route.page}${route.datasetId !== null ? `?dataset=${route.datasetId}` : ''}`
}

export function useHashRoute() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash))

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const navigate = useCallback((next: Partial<Route>) => {
    const current = parseHash(window.location.hash)
    const target = { ...current, ...next }
    // Oldalváltáskor az adatlap bezárul, hacsak külön nem kérünk adatlapot.
    if (next.page && next.page !== current.page && next.datasetId === undefined) target.datasetId = null
    window.location.hash = formatHash(target)
  }, [])

  return { route, navigate }
}
