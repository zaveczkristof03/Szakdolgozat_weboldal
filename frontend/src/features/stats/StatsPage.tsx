/**
 * Áttekintés oldal: a katalógus megoszlása grafikonokon.
 *
 * Minden grafikon egyetlen adatsor (darabszám csoportonként), ezért egy színt használ,
 * jelmagyarázat nélkül; a csoport neve és a darabszám mindig szövegként is látszik.
 * Technikailag minden grafikon egy táblázat, amelynek egyik oszlopa a sáv – így
 * képernyőolvasóval és nyomtatásban is táblázatként olvasható, külső grafikonkönyvtár nélkül.
 * Rámutatáskor (vagy billentyűzetes fókusznál) a sor megmutatja, mely adatbázisok tartoznak bele.
 */
import { useMemo, useState } from 'react'
import { byCategory, byCompleteness, byFairCheck, byFrequency, byLeads, byRecordBand, catalogTotals, type Bucket } from '../../domain/overview.ts'
import { formatNumber } from '../../domain/format.ts'
import type { ECGDatabase } from '../../domain/types.ts'
import type { Text } from '../../i18n/lang.ts'
import { s } from '../../i18n/strings.ts'
import { useLang } from '../../i18n/useLang.ts'

function BarChart({ id, title, note, buckets, total }: { id: string; title: Text; note?: Text; buckets: Bucket[]; total: number }) {
  const { t, lang } = useLang()
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count))
  const [active, setActive] = useState<Bucket | null>(null)
  return (
    <section className="chart" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{t(title)}</h2>
      {note && <p className="chart-note">{t(note)}</p>}
      <table className="bar-table">
        <thead className="visually-hidden">
          <tr><th scope="col">{t(s.stats.group)}</th><th scope="col">{t(s.stats.count)}</th></tr>
        </thead>
        <tbody>
          {buckets.map((bucket) => (
            <tr
              key={bucket.key} tabIndex={0}
              className={[bucket.key === 'missing' ? 'bar-missing' : '', active?.key === bucket.key ? 'is-active' : ''].join(' ').trim() || undefined}
              onMouseEnter={() => setActive(bucket)} onFocus={() => setActive(bucket)}
              onMouseLeave={() => setActive(null)} onBlur={() => setActive(null)}
            >
              <th scope="row">{t(bucket.label)}</th>
              <td className="bar-cell">
                <span className="bar" style={{ width: `calc((100% - 84px) * ${bucket.count / max})` }} aria-hidden="true" />
                <span className="bar-value">{formatNumber(bucket.count, lang)}<span className="bar-share"> ({Math.round((bucket.count / total) * 100)}%)</span></span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="chart-detail" aria-live="polite">
        {active
          ? <><strong>{t(active.label)}:</strong> {active.names.join(', ') || '–'}</>
          : <span className="chart-detail-hint">{t(s.stats.hoverHint)}</span>}
      </p>
    </section>
  )
}

export default function StatsPage({ databases }: { databases: ECGDatabase[] }) {
  const { t, lang } = useLang()
  const charts = useMemo(() => ({
    frequency: byFrequency(databases),
    leads: byLeads(databases),
    records: byRecordBand(databases),
    category: byCategory(databases),
    completeness: byCompleteness(databases),
    fair: byFairCheck(databases),
  }), [databases])
  const totals = catalogTotals(databases)
  const n = databases.length

  return (
    <article className="stats-page">
      <h1>{t(s.stats.title)}</h1>
      <p className="stats-intro">{t(s.stats.intro)}</p>

      <dl className="stat-tiles">
        <div><dt>{t(s.stats.totalDatasets)}</dt><dd>{formatNumber(totals.datasets, lang)}</dd></div>
        <div><dt>{t(s.stats.totalRecords)}</dt><dd>{formatNumber(totals.records, lang)}</dd></div>
        <div>
          <dt>{t(s.stats.totalSubjects)}</dt>
          <dd>
            {formatNumber(totals.subjects, lang)}
            <span className="stat-note">{t(s.stats.subjectsNote(totals.subjectsKnown, totals.datasets))}</span>
          </dd>
        </div>
      </dl>

      <div className="chart-grid">
        <BarChart id="chart-frequency" title={s.stats.frequency} buckets={charts.frequency} total={n} />
        <BarChart id="chart-leads" title={s.stats.leads} note={s.stats.leadsNote} buckets={charts.leads} total={n} />
        <BarChart id="chart-records" title={s.stats.records} buckets={charts.records} total={n} />
        <BarChart id="chart-category" title={s.stats.category} note={s.stats.categoryNote} buckets={charts.category} total={n} />
        <BarChart id="chart-completeness" title={s.stats.completeness} buckets={charts.completeness} total={n} />
        <BarChart id="chart-fair" title={s.stats.fair} note={s.stats.fairNote} buckets={charts.fair} total={n} />
      </div>
      <p className="footnote">{t(s.stats.footnote)} <a href="#/methodology">{t(s.app.pages.methodology)}</a>{t(s.stats.footnoteEnd)}</p>
    </article>
  )
}
