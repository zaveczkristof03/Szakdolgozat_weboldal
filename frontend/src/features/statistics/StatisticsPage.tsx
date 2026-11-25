/**
 * Statistics: a katalógus szerkezete valós adatokból.
 * Szándékosan NEM adjuk össze a különböző adatbázisok rekordszámait: az ilyen
 * összeg szakmailag nem értelmezhető (eltérő rekorddefiníciók).
 */
import { useMemo } from 'react'
import { licenseName } from '../../domain/search.ts'
import { NOT_RECORDED, safeExternalUrl } from '../../domain/format.ts'
import type { ECGDatabase } from '../../domain/types.ts'

type Bar = { label: string; count: number }

function countBy(databases: ECGDatabase[], key: (db: ECGDatabase) => string | number | null): Bar[] {
  const counts = new Map<string, number>()
  for (const db of databases) {
    const value = key(db)
    const label = value === null ? NOT_RECORDED : String(value)
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts.entries()].map(([label, count]) => ({ label, count }))
}

function BarList({ bars }: { bars: Bar[] }) {
  const max = Math.max(1, ...bars.map((bar) => bar.count))
  if (!bars.length) return <p className="chart-empty">No data available.</p>
  return (
    <div className="bar-chart">
      {bars.map((bar) => (
        <div className="bar-row" key={bar.label}>
          <div className="bar-label"><span>{bar.label}</span><strong>{bar.count}</strong></div>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${(bar.count / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  )
}

export default function StatisticsPage({ databases }: { databases: ECGDatabase[] }) {
  const categories = useMemo(() => countBy(databases, (db) => db.category).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)), [databases])
  const frequencies = useMemo(() => countBy(databases, (db) => db.frequency).sort((a, b) => Number(a.label) - Number(b.label)), [databases])
  const leads = useMemo(() => countBy(databases, (db) => db.leads).sort((a, b) => Number(a.label) - Number(b.label)), [databases])
  const maxFrequency = Math.max(1, ...frequencies.map((item) => item.count))
  const withSubjects = databases.filter((db) => db.subject_count !== null).length
  const withLightwave = databases.filter((db) => db.lightwave_database_id).length

  return (
    <>
      <section className="catalog-summary statistics-summary">
        <div className="summary-item"><span>Datasets in catalog</span><strong>{databases.length}</strong><small>Loaded from the API</small></div>
        <div className="summary-item"><span>Subject count documented</span><strong>{withSubjects}<small> / {databases.length}</small></strong><small>Records are always reported separately</small></div>
        <div className="summary-item"><span>Viewable in LightWAVE</span><strong>{withLightwave}<small> / {databases.length}</small></strong><small>Verified on the PhysioNet page</small></div>
      </section>

      <div className="analytics-grid">
        <section className="panel chart-panel">
          <div className="panel-heading"><div><h2>Datasets by clinical focus</h2><p>Number of catalog entries in each category.</p></div></div>
          <BarList bars={categories} />
        </section>

        <section className="panel chart-panel">
          <div className="panel-heading"><div><h2>Sampling frequency</h2><p>How many datasets use each sampling rate.</p></div></div>
          <div className="frequency-chart">
            {frequencies.map(({ label, count }) => (
              <div className="frequency-column" key={label}>
                <strong>{count}</strong>
                <div className="frequency-bar-track"><div className="frequency-bar" style={{ height: `${(count / maxFrequency) * 100}%` }} /></div>
                <span>{label === NOT_RECORDED ? label : `${label} Hz`}</span>
              </div>
            ))}
            {!frequencies.length && <p className="chart-empty">No frequency data available.</p>}
          </div>
        </section>

        <section className="panel chart-panel">
          <div className="panel-heading"><div><h2>ECG lead configuration</h2><p>Number of datasets by recorded lead count.</p></div></div>
          <BarList bars={leads.map((bar) => ({ ...bar, label: bar.label === NOT_RECORDED ? bar.label : `${bar.label} ${bar.label === '1' ? 'lead' : 'leads'}` }))} />
        </section>
      </div>

      <section className="panel verification-panel">
        <div className="panel-heading">
          <div><h2>Metadata verification</h2><p>Recorded license and last verification date for each dataset.</p></div>
          <span className="result-count">{databases.filter((db) => db.last_verified).length} dated records</span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Dataset</th><th>License</th><th>Last verified</th><th>Official source</th></tr></thead>
            <tbody>
              {databases.map((db) => {
                const sourceUrl = safeExternalUrl(db.source_url)
                return (
                  <tr key={db.id}>
                    <td><strong className="table-name">{db.name}</strong></td>
                    <td className="license-cell">{licenseName(db)}</td>
                    <td>{db.last_verified || NOT_RECORDED}</td>
                    <td>{sourceUrl ? <a className="source-link" href={sourceUrl} target="_blank" rel="noopener noreferrer">Open source ↗</a> : NOT_RECORDED}</td>
                  </tr>
                )
              })}
              {!databases.length && <tr><td colSpan={4} className="empty-state">No datasets available.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
