/**
 * Advanced Compare: legfeljebb 4 adatbázis egymás mellett.
 * - "Show differences only": csak az eltérő sorok.
 * - "Show missing metadata": a hiányos sorok ki/be.
 * - A kutatási szempontból KULCSFONTOSSÁGÚ eltérések (méret, frekvencia,
 *   elvezetés, annotáció, formátum, licenc) külön jelölést kapnak.
 */
import { Fragment, useMemo, useState } from 'react'
import { evaluateComparison, MAX_COMPARE_DATASETS } from '../../domain/compare.ts'
import { datedFilename, downloadCsv } from '../../domain/csv.ts'
import { NOT_RECORDED, safeExternalUrl } from '../../domain/format.ts'
import type { ECGDatabase } from '../../domain/types.ts'
import EmptyState from '../../components/EmptyState.tsx'

type Props = {
  databases: ECGDatabase[]
  compareIds: number[]
  onToggle: (id: number) => void
  onReset: () => void
  onOpenCatalog: () => void
}

export default function ComparePage({ databases, compareIds, onToggle, onReset, onOpenCatalog }: Props) {
  const [differencesOnly, setDifferencesOnly] = useState(false)
  const [showMissing, setShowMissing] = useState(true)
  const selected = useMemo(() => compareIds.map((id) => databases.find((db) => db.id === id)).filter((db): db is ECGDatabase => Boolean(db)), [databases, compareIds])
  const rows = useMemo(() => evaluateComparison(selected, { differencesOnly, showMissing }), [selected, differencesOnly, showMissing])
  const keyDifferences = selected.length > 1 ? rows.filter((row) => row.key && row.different) : []

  const exportComparison = () => {
    const csv: unknown[][] = [['metadata_group', 'metadata_field', 'key_difference', ...selected.map((db) => db.name)]]
    for (const row of rows) csv.push([row.group, row.label, row.key && row.different ? 'yes' : 'no', ...row.values.map((value) => value ?? NOT_RECORDED)])
    downloadCsv(datedFilename('ecg-dataset-comparison'), csv)
  }

  return (
    <section className="panel">
      <div className="panel-heading compare-heading">
        <div>
          <h2>Dataset comparison</h2>
          <p>Choose up to four datasets. Differences and undocumented fields can be isolated below.</p>
        </div>
        <div className="compare-toolbar-actions">
          <span className="result-count">{selected.length} / {MAX_COMPARE_DATASETS} selected</span>
          <button type="button" className="text-button" onClick={onReset} disabled={!compareIds.length}>Reset all</button>
          <button type="button" className="export-button" onClick={exportComparison} disabled={!selected.length}>Export comparison</button>
        </div>
      </div>

      <div className="compare-picker">
        <div>
          <strong>Choose datasets</strong>
          <span>{compareIds.length >= MAX_COMPARE_DATASETS ? `Maximum of ${MAX_COMPARE_DATASETS} datasets selected. Remove one before adding another.` : `Select between one and ${MAX_COMPARE_DATASETS} datasets to build the comparison.`}</span>
        </div>
        <div className="picker-options">
          {databases.map((db) => {
            const isSelected = compareIds.includes(db.id)
            return (
              <label key={db.id} className={`picker-option ${isSelected ? 'is-selected' : ''}`}>
                <input type="checkbox" checked={isSelected} disabled={!isSelected && compareIds.length >= MAX_COMPARE_DATASETS} onChange={() => onToggle(db.id)} />
                <span>{db.name}</span>
              </label>
            )
          })}
        </div>
      </div>

      <div className="comparison-options">
        <label className="inline-check"><input type="checkbox" checked={differencesOnly} onChange={(event) => setDifferencesOnly(event.target.checked)} /> Show differences only</label>
        <label className="inline-check"><input type="checkbox" checked={showMissing} onChange={(event) => setShowMissing(event.target.checked)} /> Show missing metadata</label>
        <span className="comparison-options-note">“Not recorded” means the catalog has no value for that field.</span>
      </div>

      {keyDifferences.length > 0 && (
        <div className="key-differences" role="note">
          <strong>Key differences for research use</strong>
          <span>{keyDifferences.map((row) => row.label).join(' · ')}</span>
        </div>
      )}

      {selected.length ? (
        <div className="table-wrapper compare-table-wrapper">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Metadata</th>
                {selected.map((db) => {
                  const sourceUrl = safeExternalUrl(db.source_url)
                  return (
                    <th key={db.id}>
                      {sourceUrl ? <a className="dataset-name-link" href={sourceUrl} target="_blank" rel="noopener noreferrer">{db.name} ↗</a> : db.name}
                      <small className="comparison-short-name">{db.short_name || 'Identifier not recorded'}</small>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const startsGroup = index === 0 || rows[index - 1].group !== row.group
                const isKey = row.key && row.different && selected.length > 1
                return (
                  <Fragment key={`${row.group}-${row.label}`}>
                    {startsGroup && <tr className="comparison-group-row"><th colSpan={selected.length + 1}>{row.group}</th></tr>}
                    <tr className={`${row.different ? 'has-difference' : ''} ${isKey ? 'is-key-difference' : ''}`}>
                      <th scope="row">{row.label}{isKey && <span className="key-difference-mark" title="Key difference for research use"> ◆</span>}</th>
                      {row.values.map((value, valueIndex) => (
                        <td key={selected[valueIndex].id} className={value === null || value.trim() === '' ? 'missing-cell' : ''}>
                          {value === null || value.trim() === '' ? NOT_RECORDED : value}
                        </td>
                      ))}
                    </tr>
                  </Fragment>
                )
              })}
              {!rows.length && (
                <tr><td colSpan={selected.length + 1} className="comparison-no-difference">No rows match the selected display options. Try showing missing metadata or turning off “Show differences only”.</td></tr>
              )}
            </tbody>
          </table>
          {differencesOnly && selected.length === 1 && <p className="comparison-result-note">Select at least two datasets to identify differences.</p>}
        </div>
      ) : (
        <EmptyState className="compare-empty" title="No datasets selected" action={{ label: 'Open catalog', onClick: onOpenCatalog }}>
          Choose up to four datasets above, or start from the catalog and add datasets to the comparison.
        </EmptyState>
      )}

      <div className="panel-footnote">
        ◆ marks a key difference: size, signal structure, annotations, file format or license. Record counts are not the number of unique people; the same label may represent different source definitions across datasets.
      </div>
    </section>
  )
}
