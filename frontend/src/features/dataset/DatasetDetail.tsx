/**
 * Egy adatbázis adatlapja. Két formában jelenik meg ugyanazzal a tartalommal:
 * - nagy képernyőn a katalógus mellett, állandó harmadik oszlopként (DatasetPanel),
 * - kisebb képernyőn és a többi oldalon jobbról becsúszó panelként (DatasetDetail).
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
import EcgSampleSection from './EcgSample.tsx'
import { s } from '../../i18n/strings.ts'
import { useLang } from '../../i18n/useLang.ts'

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

type BodyProps = Omit<Props, 'onClose'>

function DatasetDetailBody({ database: db, inComparison, compareFull, onToggleCompare }: BodyProps) {
  const sourceUrl = safeExternalUrl(db.source_url)
  const lightwave = lightwaveUrl(db.lightwave_database_id)
  const completeness = getCompleteness(db)
  const fair = getFairProfile(db)
  const { t } = useLang()

  return (
    <>
      {db.short_name && <p className="detail-code">{db.short_name}{db.version ? ` · ${t(s.detail.version)} ${db.version}` : ''}</p>}
      <p className="detail-description">{db.description || t(s.detail.noDescription)}</p>

      <div className="detail-actions">
        <button type="button" className="button" onClick={() => onToggleCompare(db.id)} disabled={!inComparison && compareFull}>
          {t(inComparison ? s.detail.removeFromCompare : compareFull ? s.detail.compareFull : s.detail.addToCompare)}
        </button>
        {sourceUrl && <a className="button button-quiet" href={sourceUrl} target="_blank" rel="noopener noreferrer">{t(s.detail.openPhysionet)}</a>}
        {lightwave && <a className="button button-quiet" href={lightwave} target="_blank" rel="noopener noreferrer">{t(s.detail.openLightwave)}</a>}
      </div>

      <EcgSampleSection key={db.id} datasetId={db.id} />

      <FactList title={t(s.detail.size)} facts={[
        { label: t(s.detail.records), value: <><Value value={db.records} />{db.records_label && <span className="fact-note"> · {db.records_label}</span>}</> },
        { label: t(s.detail.subjects), value: <Value value={db.subject_count} /> },
        { label: t(s.detail.duration), value: <Value value={db.duration} /> },
      ]} />

      <FactList title={t(s.detail.signal)} facts={[
        { label: t(s.detail.samplingRate), value: <Value value={db.frequency} unit="Hz" /> },
        { label: t(s.detail.leads), value: <Value value={db.leads} /> },
        { label: t(s.detail.category), value: db.category },
        { label: t(s.detail.annotations), value: <Value value={db.annotations} /> },
        { label: t(s.detail.fileFormat), value: <Value value={db.file_format} /> },
      ]} />

      <FactList title={t(s.detail.reuse)} facts={[
        { label: 'DOI', value: link(doiUrl(db.doi), db.doi) },
        { label: t(s.detail.sourceId), value: <Value value={db.source_database_id} /> },
        { label: t(s.detail.license), value: <Value value={db.license} /> },
        { label: t(s.detail.access), value: <Value value={db.access_conditions} /> },
        { label: t(s.detail.provenance), value: link(safeExternalUrl(db.provenance_url), db.provenance_url) },
        { label: t(s.detail.lastVerified), value: <Value value={db.last_verified} /> },
      ]} />

      <section className="detail-section">
        <h3>{t(s.detail.documentation)}</h3>
        <p>
          <strong>{t(s.detail.completeness(completeness.present, completeness.total))}</strong>
          {completeness.missing.length > 0 && <> {t(s.detail.missing)}: {completeness.missing.map((field) => t(field.label)).join(', ')}.</>}
        </p>
        <table className="fair-table">
          <caption>{t(s.detail.fairCaption)}</caption>
          <tbody>
            {fair.map((dimension) => (
              <tr key={dimension.key}>
                <th scope="row">{t(dimension.name)}</th>
                <td className="numeric">{dimension.documented}/{dimension.total}</td>
                <td>
                  {dimension.criteria.filter((criterion) => !criterion.documented).map((criterion) => `${t(s.detail.missing)}: ${t(criterion.label)}`).join('; ') || t(s.detail.allChecks)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="footnote">{t(s.detail.footnote)}</p>
    </>
  )
}

/** Becsúszó (modális) változat: kisebb képernyőn és a katalóguson kívüli oldalakon. */
export default function DatasetDetail(props: Props) {
  const { t } = useLang()
  return (
    <Modal titleId="dataset-title" title={props.database.name} onClose={props.onClose} closeLabel={t(s.detail.close)} className="drawer">
      <DatasetDetailBody {...props} />
    </Modal>
  )
}

/** Állandó oszlop változat: nagy képernyőn a katalógus mellett. Nem takarja el a táblázatot. */
export function DatasetPanel(props: Props) {
  const { t } = useLang()
  return (
    <section className="detail-panel" aria-labelledby="panel-title">
      <div className="detail-panel-heading">
        <h2 id="panel-title">{props.database.name}</h2>
        <button type="button" className="modal-close" onClick={props.onClose} aria-label={t(s.detail.close)}>{t(s.app.close)}</button>
      </div>
      <div className="detail-panel-body">
        <DatasetDetailBody {...props} />
      </div>
    </section>
  )
}
