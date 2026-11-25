/**
 * Összehasonlítás: legfeljebb 4 adatbázis egymás mellett, mezőnként.
 * - „Only show differences”: csak az eltérő sorok.
 * - A kutatási szempontból kulcsfontosságú eltérések (méret, frekvencia,
 *   elvezetés, annotáció, formátum, licenc) jelölést kapnak.
 * A sorok listája a domain/compare.ts-ben van, így a CSV-export ugyanazt használja.
 */
import { Fragment, useMemo, useState } from 'react'
import { evaluateComparison, MAX_COMPARE_DATASETS } from '../../domain/compare.ts'
import { datedFilename, downloadCsv } from '../../domain/csv.ts'
import { NOT_RECORDED } from '../../domain/format.ts'
import type { ECGDatabase } from '../../domain/types.ts'

type Props = {
  databases: ECGDatabase[]
  compareIds: number[]
  onToggle: (id: number) => void
  onReset: () => void
}

export default function ComparePage({ databases, compareIds, onToggle, onReset }: Props) {
  const [differencesOnly, setDifferencesOnly] = useState(false)
  const selected = useMemo(() => compareIds.map((id) => databases.find((db) => db.id === id)).filter((db): db is ECGDatabase => Boolean(db)), [databases, compareIds])
  const rows = useMemo(() => evaluateComparison(selected, { differencesOnly, showMissing: true }), [selected, differencesOnly])
  const available = databases.filter((db) => !compareIds.includes(db.id))
  const full = compareIds.length >= MAX_COMPARE_DATASETS

  const exportComparison = () => {
    const csv: unknown[][] = [['metadata_group', 'metadata_field', 'key_difference', ...selected.map((db) => db.name)]]
    for (const row of rows) csv.push([row.group, row.label, row.key && row.different ? 'yes' : 'no', ...row.values.map((value) => value ?? NOT_RECORDED)])
    downloadCsv(datedFilename('ecg-dataset-comparison'), csv)
  }

  return (
    <section className="compare-page" aria-labelledby="compare-heading">
      <div className="results-bar">
        <h1 id="compare-heading" className="results-heading">Compare datasets</h1>
        <div className="results-actions">
          <button type="button" className="button button-quiet" onClick={exportComparison} disabled={!selected.length}>Export CSV</button>
          <button type="button" className="link-button" onClick={onReset} disabled={!compareIds.length}>Clear selection</button>
        </div>
      </div>

      <div className="compare-controls">
        <label className="field field-inline">
          <span className="field-label">Add a dataset</span>
          <select value="" onChange={(event) => event.target.value && onToggle(Number(event.target.value))} disabled={full}>
            <option value="">{full ? `Maximum of ${MAX_COMPARE_DATASETS} selected` : 'Choose…'}</option>
            {available.map((db) => <option key={db.id} value={db.id}>{db.name}</option>)}
          </select>
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={differencesOnly} onChange={(event) => setDifferencesOnly(event.target.checked)} disabled={selected.length < 2} />
          Only show differences
        </label>
      </div>

      {selected.length === 0 ? (
        <p className="empty-block">
          No datasets selected. Tick the box next to a dataset in the <a href="#/catalog">catalog</a>, or add one above.
        </p>
      ) : (
        <div className="table-scroll">
          <table className="data-table compare-table">
            <thead>
              <tr>
                <th scope="col" className="compare-label-col">Field</th>
                {selected.map((db) => (
                  <th key={db.id} scope="col">
                    <span className="compare-name">{db.name}</span>
                    <button type="button" className="link-button" onClick={() => onToggle(db.id)} aria-label={`Remove ${db.name} from comparison`}>Remove</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const startsGroup = index === 0 || rows[index - 1].group !== row.group
                const isKey = row.key && row.different && selected.length > 1
                return (
                  <Fragment key={`${row.group}-${row.label}`}>
                    {startsGroup && <tr className="group-row"><th colSpan={selected.length + 1} scope="colgroup">{row.group}</th></tr>}
                    <tr className={isKey ? 'is-key-difference' : undefined}>
                      <th scope="row">
                        {row.label}
                        {isKey && <span className="key-mark" title="Key difference for research use"> (differs)</span>}
                      </th>
                      {row.values.map((value, valueIndex) => (
                        <td key={selected[valueIndex].id}>
                          {value === null || value.trim() === '' ? <span className="value-missing">{NOT_RECORDED}</span> : value}
                        </td>
                      ))}
                    </tr>
                  </Fragment>
                )
              })}
              {!rows.length && (
                <tr><td colSpan={selected.length + 1} className="empty-row">The selected datasets do not differ in any field.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="footnote">
        Rows marked “differs” are key differences for research use: size, sampling rate, leads, annotations, file format or license.
        Record counts are not the number of unique people.
      </p>
    </section>
  )
}
