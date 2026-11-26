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
import { s } from '../../i18n/strings.ts'
import { useLang } from '../../i18n/useLang.ts'

type Props = {
  databases: ECGDatabase[]
  compareIds: number[]
  onToggle: (id: number) => void
  onReset: () => void
}

export default function ComparePage({ databases, compareIds, onToggle, onReset }: Props) {
  const { lang, t } = useLang()
  const [differencesOnly, setDifferencesOnly] = useState(false)
  const selected = useMemo(() => compareIds.map((id) => databases.find((db) => db.id === id)).filter((db): db is ECGDatabase => Boolean(db)), [databases, compareIds])
  const rows = useMemo(() => evaluateComparison(selected, { differencesOnly, showMissing: true }, lang), [selected, differencesOnly, lang])
  const available = databases.filter((db) => !compareIds.includes(db.id))
  const full = compareIds.length >= MAX_COMPARE_DATASETS

  const exportComparison = () => {
    const csv: unknown[][] = [['metadata_group', 'metadata_field', 'key_difference', ...selected.map((db) => db.name)]]
    for (const row of rows) csv.push([t(row.group), t(row.label), row.key && row.different ? 'yes' : 'no', ...row.values.map((value) => value ?? t(NOT_RECORDED))])
    downloadCsv(datedFilename('ecg-dataset-comparison'), csv)
  }

  return (
    <section className="compare-page" aria-labelledby="compare-heading">
      <div className="results-bar">
        <h1 id="compare-heading" className="results-heading">{t(s.compare.title)}</h1>
        <div className="results-actions">
          <button type="button" className="button button-quiet" onClick={exportComparison} disabled={!selected.length}>{t(s.compare.exportCsv)}</button>
          <button type="button" className="link-button" onClick={onReset} disabled={!compareIds.length}>{t(s.compare.clear)}</button>
        </div>
      </div>

      <div className="compare-controls">
        <label className="field field-inline">
          <span className="field-label">{t(s.compare.add)}</span>
          <select value="" onChange={(event) => event.target.value && onToggle(Number(event.target.value))} disabled={full}>
            <option value="">{t(full ? s.compare.max(MAX_COMPARE_DATASETS) : s.compare.choose)}</option>
            {available.map((db) => <option key={db.id} value={db.id}>{db.name}</option>)}
          </select>
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={differencesOnly} onChange={(event) => setDifferencesOnly(event.target.checked)} disabled={selected.length < 2} />
          {t(s.compare.differencesOnly)}
        </label>
      </div>

      {selected.length === 0 ? (
        <p className="empty-block">
          {t(s.compare.emptyBefore)} <a href="#/catalog">{t(s.compare.emptyLink)}</a>{t(s.compare.emptyAfter)}
        </p>
      ) : (
        <div className="table-scroll">
          <table className="data-table compare-table">
            <thead>
              <tr>
                <th scope="col" className="compare-label-col">{t(s.compare.field)}</th>
                {selected.map((db) => (
                  <th key={db.id} scope="col">
                    <span className="compare-name">{db.name}</span>
                    <button type="button" className="link-button" onClick={() => onToggle(db.id)} aria-label={t(s.compare.removeLabel(db.name))}>{t(s.compare.remove)}</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const startsGroup = index === 0 || rows[index - 1].group.en !== row.group.en
                const isKey = row.key && row.different && selected.length > 1
                return (
                  <Fragment key={`${row.group.en}-${row.label.en}`}>
                    {startsGroup && <tr className="group-row"><th colSpan={selected.length + 1} scope="colgroup">{t(row.group)}</th></tr>}
                    <tr className={isKey ? 'is-key-difference' : undefined}>
                      <th scope="row">
                        {t(row.label)}
                        {isKey && <span className="key-mark" title={t(s.compare.differsHint)}> ({t(s.compare.differs)})</span>}
                      </th>
                      {row.values.map((value, valueIndex) => (
                        <td key={selected[valueIndex].id}>
                          {value === null || value.trim() === '' ? <span className="value-missing">{t(NOT_RECORDED)}</span> : value}
                        </td>
                      ))}
                    </tr>
                  </Fragment>
                )
              })}
              {!rows.length && (
                <tr><td colSpan={selected.length + 1} className="empty-row">{t(s.compare.noDifference)}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="footnote">
        {t(s.compare.footnote)}
      </p>
    </section>
  )
}
