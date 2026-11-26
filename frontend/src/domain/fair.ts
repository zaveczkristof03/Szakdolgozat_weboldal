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
import type { Text } from '../i18n/lang.ts'
import type { ECGDatabase } from './types.ts'
import { hasText, text } from './format.ts'

export type FairKey = 'F' | 'A' | 'I' | 'R'
export type FairCriterion = { label: Text; evidence: Text; documented: boolean }
export type FairDimension = { key: FairKey; name: Text; description: Text; criteria: FairCriterion[]; documented: number; total: number }

type CheckDefinition = { label: Text; evidence: Text; test: (db: ECGDatabase) => boolean }

const isHttpUrl = (value: string | null) => /^https?:\/\//i.test(text(value))
const DOI_PATTERN = /^10\.\d{4,9}\/\S+$/

export const fairDefinitions: Array<{ key: FairKey; name: Text; description: Text; checks: CheckDefinition[] }> = [
  {
    key: 'F', name: { hu: 'Findable (megtalálható)', en: 'Findable' }, description: { hu: 'Azonosítható és megtalálható-e az adatbázis a metaadatai alapján?', en: 'Can this dataset be identified and discovered from its metadata?' },
    checks: [
      { label: { hu: 'Tartós azonosító (DOI)', en: 'Persistent identifier (DOI)' }, evidence: { hu: 'Jól formázott DOI van rögzítve.', en: 'A well-formed DOI is recorded.' }, test: (db) => DOI_PATTERN.test(text(db.doi)) },
      { label: { hu: 'Forrásazonosító', en: 'Source database ID' }, evidence: { hu: 'A tárhely azonosítója (pl. mitdb/1.0.0) rögzítve van.', en: 'The repository identifier (e.g. mitdb/1.0.0) is recorded.' }, test: (db) => hasText(db.source_database_id) },
      { label: { hu: 'Leíró metaadatok', en: 'Descriptive metadata' }, evidence: { hu: 'Leírás és klinikai fókusz rögzítve van.', en: 'A description and a clinical focus are recorded.' }, test: (db) => hasText(db.description) && hasText(db.category) },
    ],
  },
  {
    key: 'A', name: { hu: 'Accessible (elérhető)', en: 'Accessible' }, description: { hu: 'Rögzítve van-e, hol érhető el a forrás, és milyen feltételekkel?', en: 'Is there a recorded route to the source and information about access?' },
    checks: [
      { label: { hu: 'Hivatalos forráslink', en: 'Official source URL' }, evidence: { hu: 'HTTP(S) forráslink rögzítve van; az elérhetőséget nem teszteljük.', en: 'An HTTP(S) source URL is recorded; reachability is not tested here.' }, test: (db) => isHttpUrl(db.source_url) },
      { label: { hu: 'Hozzáférési feltételek', en: 'Access conditions' }, evidence: { hu: 'A hozzáférési feltételek le vannak írva.', en: 'Access conditions are described in the catalog.' }, test: (db) => hasText(db.access_conditions) },
    ],
  },
  {
    key: 'I', name: { hu: 'Interoperable (együttműködő)', en: 'Interoperable' }, description: { hu: 'Le vannak-e írva a technikai jellemzők és az adatformátum?', en: 'Are technical characteristics and data representation described?' },
    checks: [
      { label: { hu: 'Fájlformátum', en: 'File format' }, evidence: { hu: 'Adatformátum (pl. WFDB) rögzítve van.', en: 'A data format (e.g. WFDB) is recorded.' }, test: (db) => hasText(db.file_format) },
      { label: { hu: 'Mintavételezési frekvencia', en: 'Sampling frequency' }, evidence: { hu: 'A mintavételezési frekvencia rögzítve van.', en: 'The sampling frequency is recorded.' }, test: (db) => db.frequency !== null },
      { label: { hu: 'Elvezetésszám', en: 'Lead count' }, evidence: { hu: 'Az EKG-elvezetések száma rögzítve van.', en: 'The number of ECG leads is recorded.' }, test: (db) => db.leads !== null },
      { label: { hu: 'Verzió', en: 'Dataset version' }, evidence: { hu: 'Verzióazonosító rögzítve van.', en: 'A version identifier is recorded.' }, test: (db) => hasText(db.version) },
    ],
  },
  {
    key: 'R', name: { hu: 'Reusable (újrafelhasználható)', en: 'Reusable' }, description: { hu: 'Van-e elég információ a felelős újrafelhasználás megítéléséhez?', en: 'Is enough context recorded to assess reuse responsibly?' },
    checks: [
      { label: { hu: 'Licenc', en: 'License' }, evidence: { hu: 'Licenc rögzítve van; ez nem jelent korlátlan felhasználást.', en: 'A license is recorded; this does not imply unrestricted use.' }, test: (db) => hasText(db.license) },
      { label: { hu: 'Annotációleírás', en: 'Annotation description' }, evidence: { hu: 'Az annotációk típusa vagy címkéi le vannak írva.', en: 'Annotation types or labels are described.' }, test: (db) => hasText(db.annotations) },
      { label: { hu: 'Eredetforrás', en: 'Provenance' }, evidence: { hu: 'Eredetforrás-link (provenance) rögzítve van.', en: 'A provenance URL is recorded.' }, test: (db) => isHttpUrl(db.provenance_url) },
      { label: { hu: 'Felvételi körülmények', en: 'Recording context' }, evidence: { hu: 'A felvételi időtartam rögzítve van.', en: 'Recording duration is recorded.' }, test: (db) => hasText(db.duration) },
      { label: { hu: 'Kohorszméret', en: 'Cohort size' }, evidence: { hu: 'A személyek száma rögzítve van (a rekordszámtól külön).', en: 'The number of subjects is recorded (separately from records).' }, test: (db) => db.subject_count !== null },
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
