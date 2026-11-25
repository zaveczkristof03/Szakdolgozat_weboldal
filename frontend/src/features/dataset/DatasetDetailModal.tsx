/**
 * Egy adatbázis részletes adatlapja. MINDEN mező megjelenik; ami nincs
 * rögzítve, az „Not recorded” jelölést kap (nem tűnik el).
 */
import { getCompleteness } from '../../domain/completeness.ts'
import { doiUrl, lightwaveUrl, safeExternalUrl } from '../../domain/format.ts'
import type { ECGDatabase } from '../../domain/types.ts'
import Modal from '../../components/Modal.tsx'
import Value from '../../components/Value.tsx'

type Props = {
  database: ECGDatabase
  inComparison: boolean
  compareFull: boolean
  onClose: () => void
  onSave: (id: number) => void
  onToggleCompare: (id: number) => void
}

export default function DatasetDetailModal({ database, inComparison, compareFull, onClose, onSave, onToggleCompare }: Props) {
  const sourceUrl = safeExternalUrl(database.source_url)
  const provenanceUrl = safeExternalUrl(database.provenance_url)
  const lightwave = lightwaveUrl(database.lightwave_database_id)
  const doi = doiUrl(database.doi)
  const completeness = getCompleteness(database)

  // Minden mező megjelenik; a link csak akkor, ha az érték biztonságos http(s) cím.
  const facts: Array<{ label: string; value: unknown; unit?: string; suffix?: string; href?: string | null }> = [
    { label: 'Short name', value: database.short_name },
    { label: 'Reported records', value: database.records, suffix: database.records_label ? ` (${database.records_label})` : '' },
    { label: 'Subjects', value: database.subject_count },
    { label: 'Sampling frequency', value: database.frequency, unit: 'Hz' },
    { label: 'Number of ECG leads', value: database.leads },
    { label: 'Recording duration', value: database.duration },
    { label: 'Clinical focus', value: database.category },
    { label: 'Annotations', value: database.annotations },
    { label: 'File format', value: database.file_format },
    { label: 'Dataset version', value: database.version },
    { label: 'DOI', value: database.doi, href: doi },
    { label: 'Source database ID', value: database.source_database_id },
    { label: 'License recorded in catalog', value: database.license },
    { label: 'Access conditions', value: database.access_conditions },
    { label: 'Provenance', value: database.provenance_url, href: provenanceUrl },
    { label: 'Last verified', value: database.last_verified },
    { label: 'Metadata completeness', value: `${completeness.present} of ${completeness.total} assessed fields recorded (${completeness.percent}%)` },
  ]

  return (
    <Modal titleId="dataset-modal-title" title={database.name} onClose={onClose} closeLabel="Close dataset details">
      <p className="modal-description">{database.description || 'No description has been recorded for this dataset yet.'}</p>
      <dl className="detail-grid">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd className={fact.href ? 'detail-url-value' : undefined}>
              {fact.href
                ? <a className="source-link" href={fact.href} target="_blank" rel="noopener noreferrer">{String(fact.value)} ↗</a>
                : <><Value value={fact.value} unit={fact.unit} />{fact.suffix}</>}
            </dd>
          </div>
        ))}
      </dl>
      <div className="modal-note">
        Record counts do not necessarily equal the number of unique patients. Check the dataset’s official documentation and license before reuse.
      </div>
      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={() => onSave(database.id)}>Save to My Research</button>
        <button type="button" className="secondary-button" onClick={() => onToggleCompare(database.id)} disabled={!inComparison && compareFull}>
          {inComparison ? 'Remove from comparison' : compareFull ? 'Comparison full' : 'Add to comparison'}
        </button>
        {lightwave && <a className="secondary-button" href={lightwave} target="_blank" rel="noopener noreferrer">Open in LightWAVE ↗</a>}
        {sourceUrl && <a className="primary-link" href={sourceUrl} target="_blank" rel="noopener noreferrer">Open official source ↗</a>}
      </div>
    </Modal>
  )
}
