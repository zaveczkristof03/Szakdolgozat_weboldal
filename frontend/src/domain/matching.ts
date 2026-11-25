/**
 * Szabályalapú, MAGYARÁZHATÓ egyezéskeresés a metaadatokban.
 *
 * Hogyan működik? Minden kutatási területhez és annotációtípushoz tartozik
 * néhány kifejezés. Megnézzük, hogy ezek szerepelnek-e a kijelölt mezőkben
 * (kategória, annotációk, név) – és azt is visszaadjuk, MELYIK mezőben, hogy
 * a felület meg tudja mutatni az indoklást.
 *
 * Miért nem keresünk a leírásban és a linkekben? Mert ott a szavak más
 * értelemben is előfordulnak (pl. a "t wave" a hullámhatár-annotációkban, vagy
 * az "arrhythmia" egy URL-ben), ami téves találatot adott.
 */
import type { ECGDatabase } from './types.ts'
import { text } from './format.ts'

export type ResearchFocus =
  | 'any'
  | 'atrial-fibrillation'
  | 'arrhythmia'
  | 'st-t'
  | 'normal-sinus'
  | 'waveform-delineation'
  | 'signal-quality'
  | 'clinical-diagnostic'

export type AnnotationFocus = 'any' | 'beat' | 'rhythm' | 'st' | 'waveform' | 'diagnostic' | 'signal-quality'

/** Kisbetű, a kötőjel és több szóköz egyetlen szóközzé válik: "Signal-quality" → "signal quality". */
export const normalizeTerm = (value: string): string =>
  value.toLocaleLowerCase().replace(/[-_/]+/g, ' ').replace(/\s+/g, ' ').trim()

type FocusField = 'category' | 'annotations' | 'name'

const FOCUS_FIELD_LABELS: Record<FocusField, string> = {
  category: 'clinical focus',
  annotations: 'annotations',
  name: 'dataset name',
}

export const focusRules: Record<Exclude<ResearchFocus, 'any'>, { label: string; terms: string[] }> = {
  'atrial-fibrillation': { label: 'Atrial fibrillation', terms: ['atrial fibrillation'] },
  arrhythmia: { label: 'Arrhythmia', terms: ['arrhythmia', 'tachyarrhythmia', 'ventricular ectopy'] },
  'st-t': { label: 'ST / T-wave analysis', terms: ['st t', 'st segment', 'st episodes', 'st level'] },
  'normal-sinus': { label: 'Normal sinus rhythm', terms: ['normal sinus'] },
  'waveform-delineation': { label: 'Waveform delineation', terms: ['delineation', 'waveform boundary'] },
  'signal-quality': { label: 'Signal quality / noise', terms: ['signal quality', 'noise', 'noisy'] },
  'clinical-diagnostic': {
    label: 'Clinical diagnostic ECG',
    terms: ['clinical diagnostic', 'clinical 12 lead', 'diagnostic statements', 'clinical summaries'],
  },
}

export const annotationRules: Record<Exclude<AnnotationFocus, 'any'>, { label: string; terms: string[] }> = {
  beat: { label: 'Beat annotations', terms: ['beat', 'qrs'] },
  rhythm: { label: 'Rhythm annotations', terms: ['rhythm'] },
  st: { label: 'ST annotations', terms: ['st segment', 'st episodes', 'st level'] },
  waveform: { label: 'Waveform delineation', terms: ['waveform', 'delineation', 'p, qrs and t'] },
  diagnostic: { label: 'Diagnostic labels', terms: ['diagnostic', 'diagnosis', 'clinical summaries'] },
  'signal-quality': { label: 'Signal quality / noise', terms: ['signal quality', 'noise', 'noisy'] },
}

export type FieldEvidence = { field: string; value: string; term: string }

/** Visszaadja, melyik mezőben és melyik kifejezéssel van egyezés – vagy null-t. */
export function focusEvidence(db: ECGDatabase, focus: Exclude<ResearchFocus, 'any'>): FieldEvidence | null {
  for (const field of ['category', 'annotations', 'name'] as FocusField[]) {
    const value = text(db[field])
    const normalized = normalizeTerm(value)
    const term = focusRules[focus].terms.find((candidate) => normalized.includes(candidate))
    if (term) return { field: FOCUS_FIELD_LABELS[field], value, term }
  }
  return null
}

/** Az annotációszűrő CSAK az annotációs mezőt nézi: a kategória nem bizonyítja, hogy van annotáció. */
export function matchesAnnotation(db: ECGDatabase, annotation: AnnotationFocus): boolean {
  if (annotation === 'any') return true
  const source = normalizeTerm(text(db.annotations))
  return annotationRules[annotation].terms.some((term) => source.includes(term))
}
