/**
 * Metadata quality oldal, két nézettel:
 * 1. Metadata completeness – mely mezők vannak kitöltve (domain/completeness.ts).
 * 2. FAIR readiness – dokumentációs ellenőrzések elvenként, „x / y” formában
 *    (domain/fair.ts). Ez NEM FAIR-tanúsítvány és nem pontszám.
 */
import { Fragment, useMemo, useState } from 'react'
import { completenessFields, getCompleteness } from '../../domain/completeness.ts'
import { countFairChecks, fairDefinitions, getFairProfile, type FairKey } from '../../domain/fair.ts'
import { downloadCsv } from '../../domain/csv.ts'
import type { ECGDatabase } from '../../domain/types.ts'

type Props = { databases: ECGDatabase[] }
type ViewMode = 'completeness' | 'fair'

export default function MetadataQuality({ databases }: Props) {
  const [mode, setMode] = useState<ViewMode>('completeness')
  const [missingOnly, setMissingOnly] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [expandedFairId, setExpandedFairId] = useState<number | null>(null)

  const summary = useMemo(() => {
    const profiles = databases.map(getCompleteness)
    const fairProfiles = databases.map(getFairProfile)
    // Elvenként: hány adatbázisnál teljesül MINDEN ellenőrzés.
    const fullyDocumented = Object.fromEntries(
      fairDefinitions.map(({ key }) => [key, fairProfiles.filter((profile) => {
        const dimension = profile.find((item) => item.key === key)
        return dimension !== undefined && dimension.documented === dimension.total
      }).length]),
    ) as Record<FairKey, number>
    return {
      completeness: profiles.length ? Math.round(profiles.reduce((sum, profile) => sum + profile.percent, 0) / profiles.length) : 0,
      fullyDocumented,
      needsWork: profiles.filter((profile) => profile.missing.length > 0).length,
      missingCount: profiles.reduce((sum, profile) => sum + profile.missing.length, 0),
    }
  }, [databases])

  const ordered = useMemo(() => {
    const rows = databases.map((database) => ({
      database,
      completeness: getCompleteness(database),
      fair: countFairChecks(database).documented,
    }))
    // A leghiányosabb adatbázisok kerülnek előre: ezeknél kell további adatgyűjtés.
    return rows.sort((a, b) => mode === 'completeness'
      ? a.completeness.percent - b.completeness.percent || a.database.name.localeCompare(b.database.name)
      : a.fair - b.fair || a.database.name.localeCompare(b.database.name))
  }, [databases, mode])

  const visibleRows = missingOnly && mode === 'completeness'
    ? ordered.filter((row) => row.completeness.missing.length > 0)
    : ordered

  const exportAudit = () => {
    if (mode === 'completeness') {
      const rows: unknown[][] = [[
        'dataset_id', 'dataset_name', 'metadata_completeness_percent',
        'fields_recorded', 'fields_assessed', 'missing_fields',
      ]]
      for (const { database, completeness } of ordered) {
        rows.push([
          database.id, database.name, completeness.percent,
          completeness.present, completeness.total,
          completeness.missing.map((field) => field.label).join('; '),
        ])
      }
      downloadCsv('ecg-metadata-completeness-audit.csv', rows)
      return
    }

    const rows: unknown[][] = [[
      'dataset_id', 'dataset_name', 'fair_principle', 'documented_checks_count',
      'total_checks', 'documented_checks', 'undocumented_checks',
    ]]
    for (const { database } of ordered) {
      for (const dimension of getFairProfile(database)) {
        rows.push([
          database.id, database.name, `${dimension.key} - ${dimension.name}`,
          dimension.documented,
          dimension.total,
          dimension.criteria.filter((criterion) => criterion.documented).map((criterion) => criterion.label).join('; '),
          dimension.criteria.filter((criterion) => !criterion.documented).map((criterion) => criterion.label).join('; '),
        ])
      }
    }
    downloadCsv('ecg-fair-metadata-evidence.csv', rows)
  }

  return (
    <div className="feature-page">
      <section className="feature-intro">
        <div className="quality-intro-note">
          <strong>Metadata ≠ signal quality</strong>
          <span>These indicators assess catalog documentation only. They do not rate the clinical quality of ECG recordings.</span>
        </div>
      </section>

      <div className="quality-summary-strip">
        <div><span>Datasets reviewed</span><strong>{databases.length}</strong></div>
        <div><span>Average metadata coverage</span><strong>{summary.completeness}%</strong></div>
        <div><span>Datasets needing more metadata</span><strong>{summary.needsWork}<small> / {databases.length}</small></strong></div>
        <div className="quality-fair-summary">
          <span>All FAIR checks documented (datasets)</span>
          <strong>{fairDefinitions.map(({ key }) => <span key={key}>{key} {summary.fullyDocumented[key]}/{databases.length}</span>)}</strong>
        </div>
      </div>

      <section className="panel quality-panel">
        <div className="quality-tabs" role="tablist" aria-label="Metadata quality view">
          <button type="button" role="tab" aria-selected={mode === 'completeness'} className={mode === 'completeness' ? 'active' : ''} onClick={() => setMode('completeness')}>Metadata completeness</button>
          <button type="button" role="tab" aria-selected={mode === 'fair'} className={mode === 'fair' ? 'active' : ''} onClick={() => setMode('fair')}>FAIR readiness signals</button>
        </div>

        {mode === 'completeness' ? (
          <>
            <div className="feature-panel-heading quality-heading">
              <div>
                <h3>Recorded metadata by dataset</h3>
                <p>{completenessFields.length} metadata fields are checked, including records, subjects, sampling frequency and leads. A filled field is not necessarily a verified one.</p>
              </div>
              <div className="quality-heading-actions">
                <label className="inline-check"><input type="checkbox" checked={missingOnly} onChange={(event) => setMissingOnly(event.target.checked)} /> Only show missing fields</label>
                <button type="button" className="secondary-button" onClick={exportAudit}>Export audit CSV</button>
              </div>
            </div>
            <div className="quality-list">
              {visibleRows.map(({ database, completeness }) => {
                const expanded = expandedId === database.id
                return (
                  <article className={`quality-record ${expanded ? 'expanded' : ''}`} key={database.id}>
                    <button type="button" className="quality-record-summary" aria-expanded={expanded} onClick={() => setExpandedId(expanded ? null : database.id)}>
                      <span className="quality-record-name"><strong>{database.name}</strong><small>{database.short_name || 'Short name not recorded'} · {database.version || 'Version not recorded'}</small></span>
                      <span className="quality-record-progress"><span className="quality-progress-track"><span style={{ width: `${completeness.percent}%` }} /></span><strong>{completeness.percent}%</strong></span>
                      <span className="quality-record-count">{completeness.present}/{completeness.total} fields</span>
                      <span className="quality-record-chevron">{expanded ? '−' : '+'}</span>
                    </button>
                    {expanded && (
                      <div className="quality-field-grid">
                        {completeness.fields.filter((field) => !missingOnly || !field.value).map((field) => (
                          <div className="quality-field" key={String(field.key)}>
                            <span>{field.label}</span>
                            <strong className={field.value ? 'documented' : 'not-documented'}>{field.value || 'Not recorded'}</strong>
                            <small>{field.group}</small>
                          </div>
                        ))}
                        {!completeness.missing.length && !missingOnly && <p className="quality-complete-note">All assessed optional metadata fields are recorded.</p>}
                      </div>
                    )}
                  </article>
                )
              })}
              {!visibleRows.length && <div className="feature-empty-state">{databases.length ? 'Every dataset has values in all assessed optional fields.' : 'No datasets are currently available for review.'}</div>}
            </div>
          </>
        ) : (
          <>
            <div className="feature-panel-heading quality-heading">
              <div>
                <h3>FAIR-related metadata evidence</h3>
                <p>Each cell shows how many of the listed documentation checks are satisfied. This is a checklist, not a score.</p>
              </div>
              <button type="button" className="secondary-button" onClick={exportAudit}>Export FAIR evidence CSV</button>
            </div>
            <div className="fair-explainer">
              <strong>Interpret with care</strong>
              <span>This is an indicative metadata review, not a FAIR certification or a test of whether external resources are reachable.</span>
            </div>
            <div className="fair-matrix-wrap">
              <table className="fair-matrix">
                <thead><tr><th>Dataset</th><th>F · Findable</th><th>A · Accessible</th><th>I · Interoperable</th><th>R · Reusable</th></tr></thead>
                <tbody>
                  {ordered.map(({ database }) => {
                    const dimensions = getFairProfile(database)
                    return (
                      <Fragment key={database.id}>
                      <tr>
                        <td>
                          <button type="button" className="fair-dataset-trigger" aria-expanded={expandedFairId === database.id} onClick={() => setExpandedFairId(expandedFairId === database.id ? null : database.id)}>
                            <strong>{database.name}</strong><small>{database.short_name || 'Identifier not recorded'}</small>
                          </button>
                        </td>
                        {dimensions.map((dimension) => <td key={dimension.key} className={dimension.documented < dimension.total ? 'fair-cell-incomplete' : ''}><span className="fair-cell-score">{dimension.documented} / {dimension.total}</span><small>{dimension.documented === dimension.total ? 'all checks documented' : `${dimension.total - dimension.documented} not documented`}</small></td>)}
                      </tr>
                      {expandedFairId === database.id && (
                        <tr className="fair-evidence-row" key={`${database.id}-evidence`}>
                          <td colSpan={5}>
                            <div className="fair-evidence-grid">
                              {dimensions.map((dimension) => (
                                <section key={dimension.key}>
                                  <strong>{dimension.key} · {dimension.name}</strong>
                                  {dimension.criteria.map((criterion) => (
                                    <p key={criterion.label} className={criterion.documented ? 'evidence-present' : 'evidence-missing'}>
                                      <span aria-hidden="true">{criterion.documented ? 'OK' : '—'}</span>
                                      <span>{criterion.label}</span>
                                      <small>{criterion.documented ? 'Recorded' : 'Not recorded'}</small>
                                    </p>
                                  ))}
                                </section>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="fair-dimension-notes">
              {fairDefinitions.map((dimension) => (
                <div key={dimension.key}><strong>{dimension.key} · {dimension.name}</strong><span>{dimension.description}</span><ul>{dimension.checks.map((check) => <li key={check.label}>{check.label}: {check.evidence}</li>)}</ul></div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
