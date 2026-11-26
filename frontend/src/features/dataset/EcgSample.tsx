/**
 * Mintafelvétel az adatlapon: egy valódi, 3 másodperces EKG-jelrészlet a
 * forrásból, szabványos EKG-papíron, mellette az elvezetéstérkép.
 *
 * A jelet a backend adja (`/datasets/{id}/ecg-sample`), amit a
 * `scripts/fetch_ecg_samples.py` töltött le a PhysioNetről. Ha egy adatbázishoz
 * nincs letöltött jel, a szakasz egyszerűen nem jelenik meg: helyette soha nem
 * rajzolunk illusztrációt vagy kitalált görbét.
 */
import { useEffect, useState } from 'react'
import { api } from '../../api/client.ts'
import { layoutTrace, type EcgSample, type Trace } from '../../domain/ecgTrace.ts'
import { safeExternalUrl } from '../../domain/format.ts'
import { mapLeads, type Electrode } from '../../domain/leads.ts'
import { s } from '../../i18n/strings.ts'
import { useLang } from '../../i18n/useLang.ts'

function range(end: number, step: number): number[] {
  const values: number[] = []
  for (let value = 0; value <= end + 1e-6; value += step) values.push(Math.round(value * 100) / 100)
  return values
}

/** EKG-papír: 1 mm-es kis és 5 mm-es nagy négyzetek, rajta a jel. Minden koordináta mm-ben. */
function Strip({ trace, label }: { trace: Trace; label: string }) {
  const { widthMm: w, heightMm: h } = trace
  return (
    <svg className="ecg-strip" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} preserveAspectRatio="xMinYMin meet">
      <rect className="ecg-paper" x="0" y="0" width={w} height={h} />
      {range(w, 1).map((x) => <line key={`x${x}`} className={x % 5 === 0 ? 'grid-major' : 'grid-minor'} x1={x} y1="0" x2={x} y2={h} />)}
      {range(h, 1).map((y) => <line key={`y${y}`} className={y % 5 === 0 ? 'grid-major' : 'grid-minor'} x1="0" y1={y} x2={w} y2={y} />)}
      <path className="ecg-trace" d={trace.path} />
    </svg>
  )
}

// A törzs vázlata (a néző szemszögéből: a beteg jobb oldala a kép bal oldalán van).
const POSITIONS: Record<Electrode, [number, number]> = {
  RA: [27, 38], LA: [73, 38], LL: [70, 102],
  V1: [46, 60], V2: [54, 60], V3: [58, 67], V4: [62, 73], V5: [69, 73], V6: [76, 72],
}
const LIMB_LINES: [string, Electrode, Electrode][] = [['I', 'RA', 'LA'], ['II', 'RA', 'LL'], ['III', 'LA', 'LL']]

function LeadMapFigure({ active, limbLeads, label }: { active: Set<Electrode>; limbLeads: Set<string>; label: string }) {
  return (
    <svg className="lead-map" viewBox="0 0 100 120" role="img" aria-label={label}>
      <circle className="body-outline" cx="50" cy="13" r="9" />
      <path className="body-outline" d="M38 26 Q50 30 62 26 L80 34 Q86 60 82 82 L80 116 L20 116 L18 82 Q14 60 20 34 Z" />
      {LIMB_LINES.filter(([lead]) => limbLeads.has(lead)).map(([lead, from, to]) => (
        <line key={lead} className="lead-vector" x1={POSITIONS[from][0]} y1={POSITIONS[from][1]} x2={POSITIONS[to][0]} y2={POSITIONS[to][1]} />
      ))}
      {(Object.keys(POSITIONS) as Electrode[]).map((electrode) => {
        const [x, y] = POSITIONS[electrode]
        const on = active.has(electrode)
        return (
          <g key={electrode} className={on ? 'electrode is-active' : 'electrode'}>
            <circle cx={x} cy={y} r={on ? 3 : 2.2} />
            {on && <text x={x} y={y - 4.5} textAnchor="middle">{electrode}</text>}
          </g>
        )
      })}
    </svg>
  )
}

export default function EcgSampleSection({ datasetId }: { datasetId: number }) {
  const { t } = useLang()
  const [sample, setSample] = useState<EcgSample | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    // Hiba vagy 404 esetén a szakasz rejtve marad; a katalógus ettől még működik.
    api.getEcgSample(datasetId, controller.signal).then(setSample).catch(() => undefined)
    return () => controller.abort()
  }, [datasetId])

  const trace = sample ? layoutTrace(sample.values, sample.fs) : null
  if (!sample || !trace) return null

  const leads = mapLeads(sample.signal_names)
  const sourceUrl = safeExternalUrl(sample.record_url)
  const from = sample.start_s
  const to = Math.round((sample.start_s + sample.duration_s) * 100) / 100

  return (
    <section className="detail-section ecg-sample">
      <h3>{t(s.sample.title)}</h3>
      <figure className="ecg-figure">
        <Strip trace={trace} label={t(s.sample.stripLabel(sample.signal))} />
        <figcaption>
          <span>{t(s.sample.caption(sample.record, sample.signal, from, to))}</span>
          <span className="ecg-scale">{t(s.sample.scale(trace.gainMmPerMv))}</span>
        </figcaption>
      </figure>

      <div className="lead-block">
        <LeadMapFigure active={leads.active} limbLeads={leads.leads} label={t(s.sample.mapLabel)} />
        <div>
          <h4>{t(s.sample.leadsTitle)}</h4>
          <p className="lead-names">{sample.signal_names.join(', ')}</p>
          <dl className="lead-list">
            <div><dt>{t(s.sample.mapped)}</dt><dd>{leads.mapped.length ? leads.mapped.join(', ') : t(s.sample.noneMapped)}</dd></div>
            {leads.unmapped.length > 0 && (
              <div><dt>{t(s.sample.unmapped)}</dt><dd>{leads.unmapped.join(', ')} <span className="fact-note">({t(s.sample.unmappedHint)})</span></dd></div>
            )}
          </dl>
        </div>
      </div>
      <p className="footnote">
        {t(s.sample.note)}{' '}
        {sourceUrl && <a href={sourceUrl} target="_blank" rel="noopener noreferrer">{t(s.sample.source)}</a>}
      </p>
    </section>
  )
}
