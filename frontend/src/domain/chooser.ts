/**
 * „Melyiket válasszam?” – négy egyszerű kérdés, és minden adatbázisnál
 * feltételenként megmutatjuk, teljesül-e, és miért.
 *
 * Szabályok (szándékosan egyszerűek és ellenőrizhetők):
 * - Nincs pontszám és nincs rangsor: egy adatbázis vagy minden feltételnek megfelel, vagy nem.
 * - Ha egy szükséges érték nincs rögzítve, az „nem ellenőrizhető”, és NEM számít teljesítettnek.
 * - A kutatási terület CSAK a klinikai fókusz (category) mezőt nézi, az annotációtípus
 *   CSAK az annotáció mezőt – így az indoklás mindig egy konkrét mezőre mutat.
 */
import type { Text } from '../i18n/lang.ts'
import { annotationRules, matchesAnnotation, normalizeTerm, type AnnotationFocus } from './matching.ts'
import { text } from './format.ts'
import type { ECGDatabase } from './types.ts'

export type ResearchArea = 'any' | 'atrial-fibrillation' | 'arrhythmia' | 'st-t' | 'normal-sinus' | 'delineation' | 'signal-quality' | 'diagnostic'
export type LeadNeed = 'any' | 'two-plus' | 'twelve-plus'

export type ChooserAnswers = {
  area: ResearchArea
  leads: LeadNeed
  minFrequency: number
  annotation: AnnotationFocus
}

export const emptyChooserAnswers: ChooserAnswers = { area: 'any', leads: 'any', minFrequency: 0, annotation: 'any' }

/** Kutatási terület → a klinikai fókusz mezőben keresett kifejezések. */
export const researchAreas: Record<Exclude<ResearchArea, 'any'>, { label: Text; terms: string[] }> = {
  'atrial-fibrillation': { label: { hu: 'Pitvarfibrilláció', en: 'Atrial fibrillation' }, terms: ['atrial fibrillation'] },
  arrhythmia: { label: { hu: 'Ritmuszavarok', en: 'Arrhythmias' }, terms: ['arrhythmia', 'tachyarrhythmia'] },
  'st-t': { label: { hu: 'ST–T eltérések', en: 'ST–T changes' }, terms: ['st t'] },
  'normal-sinus': { label: { hu: 'Normál szinuszritmus', en: 'Normal sinus rhythm' }, terms: ['normal sinus'] },
  delineation: { label: { hu: 'Hullámhatárok (delineáció)', en: 'Waveform delineation' }, terms: ['delineation'] },
  'signal-quality': { label: { hu: 'Jelminőség / zaj', en: 'Signal quality / noise' }, terms: ['signal quality'] },
  diagnostic: { label: { hu: 'Klinikai diagnosztika', en: 'Clinical diagnostics' }, terms: ['clinical', 'multiple conditions'] },
}

export const leadNeeds: Record<Exclude<LeadNeed, 'any'>, { label: Text; min: number }> = {
  'two-plus': { label: { hu: 'Legalább 2', en: 'At least 2' }, min: 2 },
  'twelve-plus': { label: { hu: 'Legalább 12', en: 'At least 12' }, min: 12 },
}

export const frequencyOptions = [250, 360, 500]

export type CriterionStatus = 'met' | 'unmet' | 'unknown'
export type CriterionResult = { label: Text; status: CriterionStatus; detail: Text }
export type ChooserResult = { db: ECGDatabase; fits: boolean; criteria: CriterionResult[] }

const q = (value: string) => `„${value}”`

export function evaluateChoice(db: ECGDatabase, answers: ChooserAnswers): ChooserResult {
  const criteria: CriterionResult[] = []

  if (answers.area !== 'any') {
    const area = researchAreas[answers.area]
    const category = text(db.category)
    const met = area.terms.some((term) => normalizeTerm(category).includes(term))
    criteria.push({
      label: { hu: 'Kutatási terület', en: 'Research area' },
      status: met ? 'met' : 'unmet',
      detail: { hu: `Klinikai fókusz: ${q(category)}`, en: `Clinical focus: ${q(category)}` },
    })
  }

  if (answers.leads !== 'any') {
    const need = leadNeeds[answers.leads]
    criteria.push(db.leads === null
      ? { label: { hu: 'Elvezetésszám', en: 'Leads' }, status: 'unknown', detail: { hu: 'Az elvezetésszám nincs rögzítve.', en: 'The number of leads is not recorded.' } }
      : {
        label: { hu: 'Elvezetésszám', en: 'Leads' },
        status: db.leads >= need.min ? 'met' : 'unmet',
        detail: { hu: `${db.leads} elvezetés (kell: legalább ${need.min})`, en: `${db.leads} leads (needed: at least ${need.min})` },
      })
  }

  if (answers.minFrequency > 0) {
    criteria.push(db.frequency === null
      ? { label: { hu: 'Mintavételezés', en: 'Sampling rate' }, status: 'unknown', detail: { hu: 'A mintavételezési frekvencia nincs rögzítve.', en: 'The sampling rate is not recorded.' } }
      : {
        label: { hu: 'Mintavételezés', en: 'Sampling rate' },
        status: db.frequency >= answers.minFrequency ? 'met' : 'unmet',
        detail: { hu: `${db.frequency} Hz (kell: legalább ${answers.minFrequency} Hz)`, en: `${db.frequency} Hz (needed: at least ${answers.minFrequency} Hz)` },
      })
  }

  if (answers.annotation !== 'any') {
    const annotations = text(db.annotations)
    const label = annotationRules[answers.annotation].label
    criteria.push(!annotations
      ? { label: { hu: 'Annotáció', en: 'Annotations' }, status: 'unknown', detail: { hu: 'Az annotációk nincsenek leírva.', en: 'Annotations are not described.' } }
      : {
        label: { hu: 'Annotáció', en: 'Annotations' },
        status: matchesAnnotation(db, answers.annotation) ? 'met' : 'unmet',
        detail: { hu: `${q(annotations)} (kell: ${label.hu.toLocaleLowerCase('hu')})`, en: `${q(annotations)} (needed: ${label.en.toLocaleLowerCase('en')})` },
      })
  }

  return { db, criteria, fits: criteria.every((criterion) => criterion.status === 'met') }
}

/** Az összes adatbázis kiértékelése: előbb a megfelelők, utána a többi, mindkét csoport név szerint. */
export function chooseDatasets(databases: ECGDatabase[], answers: ChooserAnswers): { fits: ChooserResult[]; others: ChooserResult[] } {
  const results = databases.map((db) => evaluateChoice(db, answers)).sort((a, b) => a.db.name.localeCompare(b.db.name))
  return { fits: results.filter((result) => result.fits), others: results.filter((result) => !result.fits) }
}

export const hasAnswers = (answers: ChooserAnswers): boolean => JSON.stringify(answers) !== JSON.stringify(emptyChooserAnswers)
