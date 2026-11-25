/**
 * FAIR readiness – a FAIR-elvekhez (Findable, Accessible, Interoperable,
 * Reusable) kapcsolódó DOKUMENTÁCIÓS ellenőrzések.
 *
 * NEM tanúsítvány és nem pontszám. Minden elvhez néhány konkrét, ellenőrizhető
 * kérdés tartozik („van-e DOI?”), és csak annyit mondunk: x / y teljesül.
 * Az előző változat olyan ellenőrzéseket is tartalmazott, amelyek mindig igazak
 * voltak (pl. „van neve”), ezért minden adatbázis 100%-ot kapott. Ezeket
 * kivettük; így a nézet valóban megmutatja a dokumentációs hiányokat.
 */
import type { ECGDatabase } from './types.ts'
import { hasText, text } from './format.ts'

export type FairKey = 'F' | 'A' | 'I' | 'R'
export type FairCriterion = { label: string; evidence: string; documented: boolean }
export type FairDimension = { key: FairKey; name: string; description: string; criteria: FairCriterion[]; documented: number; total: number }

type CheckDefinition = { label: string; evidence: string; test: (db: ECGDatabase) => boolean }

const isHttpUrl = (value: string | null) => /^https?:\/\//i.test(text(value))
const DOI_PATTERN = /^10\.\d{4,9}\/\S+$/

export const fairDefinitions: Array<{ key: FairKey; name: string; description: string; checks: CheckDefinition[] }> = [
  {
    key: 'F', name: 'Findable', description: 'Can this dataset be identified and discovered from its metadata?',
    checks: [
      { label: 'Persistent identifier (DOI)', evidence: 'A well-formed DOI is recorded.', test: (db) => DOI_PATTERN.test(text(db.doi)) },
      { label: 'Source database ID', evidence: 'The repository identifier (e.g. mitdb/1.0.0) is recorded.', test: (db) => hasText(db.source_database_id) },
      { label: 'Descriptive metadata', evidence: 'A description and a clinical focus are recorded.', test: (db) => hasText(db.description) && hasText(db.category) },
    ],
  },
  {
    key: 'A', name: 'Accessible', description: 'Is there a recorded route to the source and information about access?',
    checks: [
      { label: 'Official source URL', evidence: 'An HTTP(S) source URL is recorded; reachability is not tested here.', test: (db) => isHttpUrl(db.source_url) },
      { label: 'Access conditions', evidence: 'Access conditions are described in the catalog.', test: (db) => hasText(db.access_conditions) },
    ],
  },
  {
    key: 'I', name: 'Interoperable', description: 'Are technical characteristics and data representation described?',
    checks: [
      { label: 'File format', evidence: 'A data format (e.g. WFDB) is recorded.', test: (db) => hasText(db.file_format) },
      { label: 'Sampling frequency', evidence: 'The sampling frequency is recorded.', test: (db) => db.frequency !== null },
      { label: 'Lead count', evidence: 'The number of ECG leads is recorded.', test: (db) => db.leads !== null },
      { label: 'Dataset version', evidence: 'A version identifier is recorded.', test: (db) => hasText(db.version) },
    ],
  },
  {
    key: 'R', name: 'Reusable', description: 'Is enough context recorded to assess reuse responsibly?',
    checks: [
      { label: 'License', evidence: 'A license is recorded; this does not imply unrestricted use.', test: (db) => hasText(db.license) },
      { label: 'Annotation description', evidence: 'Annotation types or labels are described.', test: (db) => hasText(db.annotations) },
      { label: 'Provenance', evidence: 'A provenance URL is recorded.', test: (db) => isHttpUrl(db.provenance_url) },
      { label: 'Recording context', evidence: 'Recording duration is recorded.', test: (db) => hasText(db.duration) },
      { label: 'Cohort size', evidence: 'The number of subjects is recorded (separately from records).', test: (db) => db.subject_count !== null },
    ],
  },
]

export function getFairProfile(db: ECGDatabase): FairDimension[] {
  return fairDefinitions.map(({ checks, ...dimension }) => {
    const criteria = checks.map(({ test, ...check }) => ({ ...check, documented: test(db) }))
    return { ...dimension, criteria, documented: criteria.filter((item) => item.documented).length, total: criteria.length }
  })
}

/** Az összes ellenőrzésből hány teljesül (rendezéshez; nem „FAIR-pontszám”). */
export function countFairChecks(db: ECGDatabase): { documented: number; total: number } {
  return getFairProfile(db).reduce(
    (sum, dimension) => ({ documented: sum.documented + dimension.documented, total: sum.total + dimension.total }),
    { documented: 0, total: 0 },
  )
}
