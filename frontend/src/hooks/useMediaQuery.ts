/** Igaz, ha a képernyő megfelel a megadott CSS media querynek (pl. elég széles a harmadik oszlophoz). */
import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia?.(query).matches ?? false)

  useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = () => setMatches(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** Ettől a szélességtől fér el a szűrők, a táblázat és az adatlap egymás mellett. */
export const WIDE_LAYOUT_QUERY = '(min-width: 1600px)'
