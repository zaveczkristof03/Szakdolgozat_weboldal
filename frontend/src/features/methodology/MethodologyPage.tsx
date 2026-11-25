/**
 * Módszertan oldal: mit tartalmaz a katalógus, honnan származnak az adatok,
 * hogyan számoljuk a dokumentáltságot, és mik a korlátok.
 *
 * Ez váltotta ki a korábbi „Metadata quality” oldalt: ugyanaz a mérés
 * (domain/completeness.ts és domain/fair.ts), de egy helyen, magyarázattal.
 * A szakdolgozat módszertani fejezete erre az oldalra hivatkozhat.
 */
import { useMemo } from 'react'
import { completenessFields, getCompleteness } from '../../domain/completeness.ts'
import { fairDefinitions } from '../../domain/fair.ts'
import type { ECGDatabase } from '../../domain/types.ts'

type Props = { databases: ECGDatabase[]; onOpen: (id: number) => void }

export default function MethodologyPage({ databases, onOpen }: Props) {
  const verifiedDates = databases.map((db) => db.last_verified).filter((date): date is string => Boolean(date)).sort()
  const groups = [...new Set(completenessFields.map((field) => field.group))]
  const rows = useMemo(
    () => databases
      .map((db) => ({ db, completeness: getCompleteness(db) }))
      .sort((a, b) => a.completeness.present - b.completeness.present || a.db.name.localeCompare(b.db.name)),
    [databases],
  )

  return (
    <article className="prose">
      <h1>Methodology</h1>

      <section>
        <h2>What the catalog contains</h2>
        <p>
          The catalog describes {databases.length} open electrocardiogram datasets published on PhysioNet.
          Every value was taken from the dataset’s official PhysioNet project page and checked against it
          {verifiedDates.length > 0 && <> between {verifiedDates[0]} and {verifiedDates[verifiedDates.length - 1]}</>}.
          The catalog stores metadata only. It does not store or analyse the ECG signals themselves.
        </p>
        <p>
          The verified values are kept in a version-controlled file (<code>backend/data/catalog.json</code>).
          The web application reads them through a read-only API.
        </p>
      </section>

      <section>
        <h2>Two rules for reading the values</h2>
        <dl className="rule-list">
          <dt>Records are not subjects</dt>
          <dd>
            A record is one recording. A subject is one person. One person can contribute several records,
            so the two numbers are stored and shown separately and are never derived from each other.
          </dd>
          <dt>“Not recorded” means unknown</dt>
          <dd>
            If the official documentation does not state a value, the field stays empty and is shown as “Not recorded”.
            It is never filled with an estimate or a typical value, and it never counts as meeting a filter.
          </dd>
        </dl>
      </section>

      <section>
        <h2>How “Documented” is counted</h2>
        <p>
          For each dataset we check whether these {completenessFields.length} fields are recorded.
          The result is reported as a count (for example 14/16), not as a quality score.
          It measures how well a dataset is documented in this catalog, not the quality of its signals
          and not whether a recorded value is correct.
        </p>
        <table className="data-table compact">
          <thead><tr><th scope="col">Group</th><th scope="col">Fields</th></tr></thead>
          <tbody>
            {groups.map((group) => (
              <tr key={group}>
                <th scope="row">{group}</th>
                <td>{completenessFields.filter((field) => field.group === group).map((field) => field.label).join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>Result for each dataset</h3>
        <div className="table-scroll">
          <table className="data-table compact">
            <thead>
              <tr><th scope="col">Dataset</th><th scope="col" className="numeric">Documented</th><th scope="col">Not recorded</th></tr>
            </thead>
            <tbody>
              {rows.map(({ db, completeness }) => (
                <tr key={db.id}>
                  <td><button type="button" className="dataset-link" onClick={() => onOpen(db.id)}>{db.name}</button></td>
                  <td className="numeric">{completeness.present}/{completeness.total}</td>
                  <td>{completeness.missing.map((field) => field.label).join(', ') || '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>Documentation checks related to FAIR</h2>
        <p>
          The FAIR principles (Findable, Accessible, Interoperable, Reusable) describe what makes research data reusable.
          The dataset page lists a few concrete checks for each principle and reports how many are met.
          This is a reading aid, not a FAIR certification or assessment.
        </p>
        <table className="data-table compact">
          <thead><tr><th scope="col">Principle</th><th scope="col">Check</th><th scope="col">Met when</th></tr></thead>
          <tbody>
            {fairDefinitions.flatMap((dimension) => dimension.checks.map((check, index) => (
              <tr key={`${dimension.key}-${check.label}`}>
                {index === 0 && <th scope="rowgroup" rowSpan={dimension.checks.length}>{dimension.name}</th>}
                <td>{check.label}</td>
                <td>{check.evidence}</td>
              </tr>
            )))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Limitations</h2>
        <ul>
          <li>The catalog covers a selection of PhysioNet datasets, not every public ECG dataset.</li>
          <li>Links are checked to be well-formed web addresses. Whether they are still reachable is not tested automatically.</li>
          <li>Annotation filters match terms in the recorded annotation description, so a dataset with poorly described annotations may be missed.</li>
          <li>Licenses are recorded as stated on PhysioNet. Always read the license before reusing data.</li>
        </ul>
      </section>
    </article>
  )
}
