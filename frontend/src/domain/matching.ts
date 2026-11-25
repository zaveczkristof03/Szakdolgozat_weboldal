/**
 * Az annotációtípus-szűrő szabályai (katalógus oldal).
 *
 * Hogyan működik? Minden annotációtípushoz tartozik néhány kifejezés, és
 * megnézzük, szerepel-e valamelyik az adatbázis `annotations` mezőjében.
 * Szándékosan CSAK ezt a mezőt nézzük: a kategória vagy a leírás nem bizonyítja,
 * hogy az adatbázisban tényleg van ilyen annotáció.
 */
import type { Text } from '../i18n/lang.ts'
import type { ECGDatabase } from './types.ts'
import { text } from './format.ts'

export type AnnotationFocus = 'any' | 'beat' | 'rhythm' | 'st' | 'waveform' | 'diagnostic' | 'signal-quality'

/** Kisbetű, a kötőjel és több szóköz egyetlen szóközzé válik: "Signal-quality" → "signal quality". */
export const normalizeTerm = (value: string): string =>
  value.toLocaleLowerCase().replace(/[-_/]+/g, ' ').replace(/\s+/g, ' ').trim()

export const annotationRules: Record<Exclude<AnnotationFocus, 'any'>, { label: Text; terms: string[] }> = {
  beat: { label: { hu: 'Szívütés-annotáció', en: 'Beat annotations' }, terms: ['beat', 'qrs'] },
  rhythm: { label: { hu: 'Ritmusannotáció', en: 'Rhythm annotations' }, terms: ['rhythm'] },
  st: { label: { hu: 'ST-annotáció', en: 'ST annotations' }, terms: ['st segment', 'st episodes', 'st level'] },
  waveform: { label: { hu: 'Hullámhatárok (delineáció)', en: 'Waveform delineation' }, terms: ['waveform', 'delineation', 'p, qrs and t'] },
  diagnostic: { label: { hu: 'Diagnosztikai címkék', en: 'Diagnostic labels' }, terms: ['diagnostic', 'diagnosis', 'clinical summaries'] },
  'signal-quality': { label: { hu: 'Jelminőség / zaj', en: 'Signal quality / noise' }, terms: ['signal quality', 'noise', 'noisy'] },
}

/** Az annotációszűrő CSAK az annotációs mezőt nézi: a kategória nem bizonyítja, hogy van annotáció. */
export function matchesAnnotation(db: ECGDatabase, annotation: AnnotationFocus): boolean {
  if (annotation === 'any') return true
  const source = normalizeTerm(text(db.annotations))
  return annotationRules[annotation].terms.some((term) => source.includes(term))
}
