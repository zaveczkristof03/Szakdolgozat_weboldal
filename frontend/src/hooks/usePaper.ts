/**
 * Milliméterpapír-háttér ki/be kapcsolása.
 *
 * Az oldal hátterén halvány EKG-papír rács (1 mm-es kis, 5 mm-es nagy négyzetek).
 * Alapból be van kapcsolva; a választást a böngésző megjegyzi. A kapcsoló a
 * <html data-paper="on|off"> attribútumot állítja, a rácsot a CSS rajzolja
 * (styles/base.css), így kikapcsolva semmi nem marad belőle.
 */
import { useEffect, useState } from 'react'

export const PAPER_STORAGE_KEY = 'ekg-paper'

function initialPaper(): boolean {
  try {
    return window.localStorage.getItem(PAPER_STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

export function usePaper() {
  const [paper, setPaper] = useState<boolean>(initialPaper)

  useEffect(() => {
    document.documentElement.dataset.paper = paper ? 'on' : 'off'
  }, [paper])

  const togglePaper = () => {
    const next = !paper
    setPaper(next)
    try {
      window.localStorage.setItem(PAPER_STORAGE_KEY, next ? 'on' : 'off')
    } catch {
      // Ha nem menthető, a választás csak az aktuális munkamenetre él.
    }
  }

  return { paper, togglePaper }
}
