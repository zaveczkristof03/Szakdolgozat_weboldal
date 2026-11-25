/**
 * Egy adatbázis adatlapja (jobb oldalról becsúszó panel).
 *
 * MINDEN mező megjelenik; ami nincs rögzítve, „Not recorded” jelölést kap
 * (nem tűnik el). Az alján a dokumentáltság: hány mező van kitöltve, mi hiányzik,
 * és a FAIR-elvekhez kapcsolódó dokumentációs ellenőrzések (nem tanúsítvány).
 */
import type { ReactNode } from 'react'
import { getCompleteness } from '../../domain/completeness.ts'
import { getFairProfile } from '../../domain/fair.ts'
import { doiUrl, lightwaveUrl, safeExternalUrl } from '../../domain/format.ts'
import type { ECGDatabase } from '../../domain/types.ts'
import Modal from '../../components/Modal.tsx'
import Value from '../../components/Value.tsx'

type Props = {
  database: ECGDatabase
  inComparison: boolean
  compareFull: boolean
  onClose: () => void
  onToggleCompare: (id: number) => void
}

type Fact = { label: string; value: ReactNode }

function link(href: string | null, label: string | null): ReactNode {
  return href && label ? <a href={href} target="_blank" rel="noopener noreferrer">{label}</a> : <Value value={label} />
}

function FactList({ title, facts }: { title: string; facts: Fact[] }) {
  return (
    <section className="detail-section">
      <h3>{title}</h3>
      <dl className="fact-list">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export default function DatasetDetail({ database: db, inComparison, compareFull, onClose, onToggleCompare }: Props) {
  const sourceUrl = safeExternalUrl(db.source_url)
  const lightwave = lightwaveUrl(db.lightwave_database_id)
  const completeness = getCompleteness(db)
  const fair = getFairProfile(db)

  return (
    <Modal titleId="dataset-title" title={db.name} onClose={onClose} closeLabel="Close dataset details" className="drawer">
      {db.short_name && <p className="detail-code">{db.short_name}{db.version ? ` · version ${db.version}` : ''}</p>}
      <p className="detail-description">{db.description || 'No description has been recorded for this dataset.'}</p>

      <div className="detail-actions">
        <button type="button" className="button" onClick={() => onToggleCompare(db.id)} disabled={!inComparison && compareFull}>
          {inComparison ? 'Remove from comparison' : compareFull ? 'Comparison is full (4)' : 'Add to comparison'}
        </button>
        {sourceUrl && <a className="button button-quiet" href={sourceUrl} target="_blank" rel="noopener noreferrer">Open on PhysioNet</a>}
        {lightwave && <a className="button button-quiet" href={lightwave} target="_blank" rel="noopener noreferrer">View signals in LightWAVE</a>}
      </div>

      <FactList title="Size" facts={[
        { label: 'Records', value: <><Value value={db.records} />{db.records_label && <span className="fact-note"> · {db.records_label}</span>}</> },
        { label: 'Subjects', value: <Value value={db.subject_count} /> },
        { label: 'Recording duration', value: <Value value={db.duration} /> },
      ]} />

      <FactList title="Signal and annotations" facts={[
        { label: 'Sampling rate', value: <Value value={db.frequency} unit="Hz" /> },
        { label: 'ECG leads', value: <Value value={db.leads} /> },
        { label: 'Clinical focus', value: db.category },
        { label: 'Annotations', value: <Value value={db.annotations} /> },
        { label: 'File format', value: <Value value={db.file_format} /> },
      ]} />

      <FactList title="Identification and reuse" facts={[
        { label: 'DOI', value: link(doiUrl(db.doi), db.doi) },
        { label: 'Source ID', value: <Value value={db.source_database_id} /> },
        { label: 'License', value: <Value value={db.license} /> },
        { label: 'Access', value: <Value value={db.access_conditions} /> },
        { label: 'Provenance', value: link(safeExternalUrl(db.provenance_url), db.provenance_url) },
        { label: 'Last verified', value: <Value value={db.last_verified} /> },
      ]} />

      <section className="detail-section">
        <h3>Documentation</h3>
        <p>
          <strong>{completeness.present} of {completeness.total}</strong> assessed fields are recorded.
          {completeness.missing.length > 0 && <> Missing: {completeness.missing.map((field) => field.label).join(', ')}.</>}
        </p>
        <table className="fair-table">
          <caption>Documentation checks related to the FAIR principles. This is not a FAIR certification.</caption>
          <tbody>
            {fair.map((dimension) => (
              <tr key={dimension.key}>
                <th scope="row">{dimension.name}</th>
                <td className="numeric">{dimension.documented}/{dimension.total}</td>
                <td>
                  {dimension.criteria.filter((criterion) => !criterion.documented).map((criterion) => `Missing: ${criterion.label}`).join('; ') || 'All checks documented'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="footnote">Check the official documentation and license on PhysioNet before reusing the data.</p>
    </Modal>
  )
}
