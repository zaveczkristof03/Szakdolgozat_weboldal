/**
 * Research Fit Finder – kutatási követelmények szerinti szűrés INDOKLÁSSAL.
 *
 * Nincs pontszám és nincs rangsor: egy adatbázis akkor találat, ha MINDEN
 * kiválasztott feltétel teljesül a rögzített metaadatok alapján. Ha egy adat
 * hiányzik, az nem számít teljesítettnek – a kizárt listában ezt meg is mondjuk.
 */
import type { ECGDatabase } from './types.ts'
import { formatNumber, hasText } from './format.ts'
import { annotationRules, focusEvidence, focusRules, matchesAnnotation, type AnnotationFocus, type ResearchFocus } from './matching.ts'

export type ResearchCriteria = {
  focus: ResearchFocus
  leads: number | null
  minFrequency: number
  annotation: AnnotationFocus
  fileFormat: string
  minRecords: number | null
  minSubjects: number | null
}

export const emptyResearchCriteria: ResearchCriteria = {
  focus: 'any',
  leads: null,
  minFrequency: 0,
  annotation: 'any',
  fileFormat: 'any',
  minRecords: null,
  minSubjects: null,
}

export type ResearchMatch = {
  dataset: ECGDatabase
  reasons: string[]
  missingEvidence: string[]
}

export function countActiveCriteria(criteria: ResearchCriteria): number {
  return (Object.keys(emptyResearchCriteria) as Array<keyof ResearchCriteria>)
    .filter((key) => criteria[key] !== emptyResearchCriteria[key]).length
}

/** Egy minimum-feltétel ellenőrzése; a hiányzó érték mindig kizáró ok. */
function checkMinimum(value: number | null, minimum: number, noun: string, unit: string, result: ResearchMatch): boolean {
  if (value === null) {
    result.missingEvidence.push(`${noun} is not recorded, so the minimum of ${formatNumber(minimum)}${unit} cannot be verified.`)
    return false
  }
  if (value >= minimum) {
    result.reasons.push(`${noun}: ${formatNumber(value)}${unit} (minimum ${formatNumber(minimum)}${unit}).`)
    return true
  }
  result.missingEvidence.push(`${noun} is ${formatNumber(value)}${unit}, below the required ${formatNumber(minimum)}${unit}.`)
  return false
}

export function evaluateDataset(db: ECGDatabase, criteria: ResearchCriteria): { accepted: boolean; match: ResearchMatch } {
  const match: ResearchMatch = { dataset: db, reasons: [], missingEvidence: [] }
  let accepted = true

  if (criteria.focus !== 'any') {
    const evidence = focusEvidence(db, criteria.focus)
    const label = focusRules[criteria.focus].label
    if (evidence) match.reasons.push(`Research focus “${label}” is documented in the ${evidence.field}: “${evidence.value}”.`)
    else {
      accepted = false
      match.missingEvidence.push(`No documented match for ${label} in the clinical focus, annotations or name.`)
    }
  }

  if (criteria.leads !== null) {
    if (db.leads === null) {
      accepted = false
      match.missingEvidence.push('The number of ECG leads is not recorded.')
    } else if (db.leads === criteria.leads) match.reasons.push(`${criteria.leads}-lead ECG configuration.`)
    else {
      accepted = false
      match.missingEvidence.push(`Requires ${criteria.leads} leads; ${db.leads} leads are recorded.`)
    }
  }

  if (criteria.minFrequency > 0) accepted = checkMinimum(db.frequency, criteria.minFrequency, 'Sampling frequency', ' Hz', match) && accepted

  if (criteria.annotation !== 'any') {
    const label = annotationRules[criteria.annotation].label
    if (matchesAnnotation(db, criteria.annotation)) match.reasons.push(`${label} are documented: “${db.annotations}”.`)
    else {
      accepted = false
      match.missingEvidence.push(hasText(db.annotations) ? `The requested ${label.toLocaleLowerCase()} are not documented.` : 'Annotation metadata is not recorded.')
    }
  }

  if (criteria.fileFormat !== 'any') {
    if ((db.file_format ?? '').toLocaleLowerCase() === criteria.fileFormat.toLocaleLowerCase()) match.reasons.push(`Recorded file format: ${db.file_format}.`)
    else {
      accepted = false
      match.missingEvidence.push(hasText(db.file_format) ? `The required format is ${criteria.fileFormat}; the catalog records ${db.file_format}.` : 'File format is not documented.')
    }
  }

  if (criteria.minRecords !== null) accepted = checkMinimum(db.records, criteria.minRecords, 'Records', '', match) && accepted
  if (criteria.minSubjects !== null) accepted = checkMinimum(db.subject_count, criteria.minSubjects, 'Subject count', '', match) && accepted

  return { accepted, match }
}

export function findResearchMatches(databases: ECGDatabase[], criteria: ResearchCriteria): { matches: ResearchMatch[]; excluded: ResearchMatch[] } {
  const matches: ResearchMatch[] = []
  const excluded: ResearchMatch[] = []
  for (const db of databases) {
    const { accepted, match } = evaluateDataset(db, criteria)
    ;(accepted ? matches : excluded).push(match)
  }
  return { matches, excluded }
}
