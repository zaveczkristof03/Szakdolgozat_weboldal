/**
 * „Melyiket válasszam?” oldal: bal oldalt négy kérdés, jobbra az eredmény.
 *
 * Minden adatbázisnál feltételenként látszik, mi teljesül, mi nem, és mi nem
 * ellenőrizhető (mert az érték nincs rögzítve). Pontszám és rangsor nincs.
 * A szabályok a domain/chooser.ts-ben vannak, és tesztelve vannak.
 */
import { useMemo, useState } from 'react'
import {
  chooseDatasets, emptyChooserAnswers, frequencyOptions, hasAnswers, leadNeeds, researchAreas,
  type ChooserAnswers, type ChooserResult, type CriterionStatus, type LeadNeed, type ResearchArea,
} from '../../domain/chooser.ts'
import { MAX_COMPARE_DATASETS } from '../../domain/compare.ts'
import { annotationRules, type AnnotationFocus } from '../../domain/matching.ts'
import type { ECGDatabase } from '../../domain/types.ts'
import { s } from '../../i18n/strings.ts'
import { useLang } from '../../i18n/useLang.ts'

type Props = {
  databases: ECGDatabase[]
  onOpen: (id: number) => void
  onCompareAll: (ids: number[]) => void
}

type Option<T> = { value: T; label: string }

function Question<T extends string | number>({ legend, name, options, value, onChange }: {
  legend: string; name: string; options: Option<T>[]; value: T; onChange: (value: T) => void
}) {
  return (
    <fieldset className="question">
      <legend>{legend}</legend>
      {options.map((option) => (
        <label key={String(option.value)} className="radio">
          <input type="radio" name={name} checked={value === option.value} onChange={() => onChange(option.value)} />
          {option.label}
        </label>
      ))}
    </fieldset>
  )
}

const MARK: Record<CriterionStatus, string> = { met: '✓', unmet: '✗', unknown: '?' }

function ResultItem({ result, onOpen }: { result: ChooserResult; onOpen: (id: number) => void }) {
  const { t } = useLang()
  return (
    <li className="choice-item">
      <button type="button" className="dataset-link" onClick={() => onOpen(result.db.id)}>{result.db.name}</button>
      {result.db.short_name && <span className="dataset-code">{result.db.short_name}</span>}
      <ul className="criteria">
        {result.criteria.map((criterion) => (
          <li key={criterion.label.en} className={`criterion criterion-${criterion.status}`}>
            <span className="criterion-mark" aria-hidden="true">{MARK[criterion.status]}</span>
            <span className="visually-hidden">{t(s.chooser.status[criterion.status])}: </span>
            <strong>{t(criterion.label)}</strong> – {t(criterion.detail)}
          </li>
        ))}
      </ul>
    </li>
  )
}

export default function ChooserPage({ databases, onOpen, onCompareAll }: Props) {
  const { t } = useLang()
  const [answers, setAnswers] = useState<ChooserAnswers>(emptyChooserAnswers)
  const set = <K extends keyof ChooserAnswers>(key: K, value: ChooserAnswers[K]) => setAnswers((current) => ({ ...current, [key]: value }))
  const { fits, others } = useMemo(() => chooseDatasets(databases, answers), [databases, answers])
  const any = t(s.filters.any)

  return (
    <div className="catalog-layout">
      <aside className="catalog-sidebar">
        <h1 className="results-heading chooser-title">{t(s.chooser.title)}</h1>
        <p className="chooser-intro">{t(s.chooser.intro)}</p>
        <form className="questions" onSubmit={(event) => event.preventDefault()}>
          <Question<ResearchArea>
            legend={t(s.chooser.qArea)} name="area" value={answers.area} onChange={(value) => set('area', value)}
            options={[{ value: 'any', label: any }, ...(Object.keys(researchAreas) as Array<keyof typeof researchAreas>).map((key) => ({ value: key, label: t(researchAreas[key].label) }))]}
          />
          <Question<LeadNeed>
            legend={t(s.chooser.qLeads)} name="leads" value={answers.leads} onChange={(value) => set('leads', value)}
            options={[{ value: 'any', label: any }, ...(Object.keys(leadNeeds) as Array<keyof typeof leadNeeds>).map((key) => ({ value: key, label: t(leadNeeds[key].label) }))]}
          />
          <Question<number>
            legend={t(s.chooser.qFrequency)} name="frequency" value={answers.minFrequency} onChange={(value) => set('minFrequency', value)}
            options={[{ value: 0, label: any }, ...frequencyOptions.map((hz) => ({ value: hz, label: `≥ ${hz} Hz` }))]}
          />
          <Question<AnnotationFocus>
            legend={t(s.chooser.qAnnotation)} name="annotation" value={answers.annotation} onChange={(value) => set('annotation', value)}
            options={[{ value: 'any', label: any }, ...(Object.keys(annotationRules) as Array<keyof typeof annotationRules>).map((key) => ({ value: key, label: t(annotationRules[key].label) }))]}
          />
          <button type="button" className="link-button" onClick={() => setAnswers(emptyChooserAnswers)} disabled={!hasAnswers(answers)}>
            {t(s.chooser.reset)}
          </button>
        </form>
      </aside>

      <section className="catalog-results" aria-live="polite">
        {!hasAnswers(answers) ? (
          <p className="empty-block">{t(s.chooser.start)}</p>
        ) : (
          <>
            <div className="results-bar">
              <h2 className="results-heading">{t(s.chooser.fitCount(fits.length, databases.length))}</h2>
              {fits.length > 0 && fits.length <= MAX_COMPARE_DATASETS && (
                <button type="button" className="button" onClick={() => onCompareAll(fits.map((result) => result.db.id))}>
                  {t(s.chooser.compareFits)}
                </button>
              )}
            </div>
            {fits.length ? (
              <ul className="choice-list">{fits.map((result) => <ResultItem key={result.db.id} result={result} onOpen={onOpen} />)}</ul>
            ) : (
              <p className="empty-block">{t(s.chooser.noFit)}</p>
            )}

            {others.length > 0 && (
              <details className="others">
                <summary>{t(s.chooser.others(others.length))}</summary>
                <ul className="choice-list">{others.map((result) => <ResultItem key={result.db.id} result={result} onOpen={onOpen} />)}</ul>
              </details>
            )}

            <p className="footnote">{t(s.chooser.footnote)}</p>
          </>
        )}
      </section>
    </div>
  )
}
