/**
 * Módszertan oldal: mit tartalmaz a katalógus, honnan származnak az adatok,
 * hogyan számoljuk a kitöltöttséget, és mik a korlátok.
 *
 * Ez váltotta ki a korábbi „Metadata quality” oldalt: ugyanaz a mérés
 * (domain/completeness.ts és domain/fair.ts), de egy helyen, magyarázattal.
 * A szakdolgozat módszertani fejezete erre az oldalra hivatkozhat.
 * A hosszabb szövegek nyelvenként külön vannak megírva (lásd a `copy` objektumot).
 */
import { useMemo } from 'react'
import { completenessFields, getCompleteness } from '../../domain/completeness.ts'
import { fairDefinitions } from '../../domain/fair.ts'
import type { ECGDatabase } from '../../domain/types.ts'
import { useLang } from '../../i18n/useLang.ts'

type Props = { databases: ECGDatabase[]; onOpen: (id: number) => void }

const copy = {
  hu: {
    title: 'Módszertan',
    containsTitle: 'Mit tartalmaz a katalógus?',
    contains: (n: number, range: string) => `A katalógus ${n} nyilvános, a PhysioNeten publikált EKG-adatbázist ír le. Minden érték az adatbázis hivatalos PhysioNet-oldaláról származik, és azzal össze lett vetve${range ? ` (${range})` : ''}. A katalógus csak metaadatokat tárol: magukat az EKG-jeleket nem tárolja és nem elemzi.`,
    range: (from: string, to: string) => `${from} és ${to} között`,
    storageBefore: 'Az ellenőrzött értékek egy verziókezelt fájlban vannak (',
    storageAfter: '), a webes felület ezeket egy csak olvasható API-n keresztül kapja meg.',
    language: 'A felület magyarul és angolul is használható, az adatértékek (kategória, annotáció, leírás, licenc) viszont a PhysioNet eredeti, angol nyelvű szövegei. Ezeket szándékosan nem fordítottuk le, hogy a forrást pontosan idézzék.',
    rulesTitle: 'Két szabály az értékek olvasásához',
    rule1Title: 'A rekord nem azonos a személlyel',
    rule1: 'A rekord egy felvétel, a személy egy vizsgált ember. Egy személytől több rekord is származhat, ezért a két számot külön tároljuk és mutatjuk, és egyiket sem számoljuk ki a másikból.',
    rule2Title: 'A „Nincs adat” azt jelenti: ismeretlen',
    rule2: 'Ha a hivatalos dokumentáció nem közöl egy értéket, a mező üres marad, és „Nincs adat” jelölést kap. Becsült vagy tipikus értékkel soha nem pótoljuk, és egy szűrőnek sem felel meg.',
    completenessTitle: 'Hogyan számoljuk a kitöltöttséget?',
    completeness: (n: number) => `Minden adatbázisnál megnézzük, hogy az alábbi ${n} mező ki van-e töltve. Az eredmény egy darabszám (például 15/16), nem minőségi pontszám. Azt méri, mennyire jól dokumentált az adatbázis ebben a katalógusban, nem a jelek minőségét, és nem azt, hogy egy kitöltött érték helyes-e.`,
    group: 'Csoport', fields: 'Mezők', perDataset: 'Eredmény adatbázisonként', dataset: 'Adatbázis', documented: 'Kitöltöttség', missing: 'Hiányzó mezők',
    fairTitle: 'A FAIR-elvekhez kapcsolódó ellenőrzések',
    fair: 'A FAIR-elvek (Findable, Accessible, Interoperable, Reusable) azt írják le, mitől lesz egy kutatási adat újrafelhasználható. Az adatlapon minden elvhez néhány konkrét, eldönthető ellenőrzés tartozik, és azt mutatjuk, hány teljesül. Ez olvasási segítség, nem FAIR-tanúsítvány és nem teljes FAIR-értékelés.',
    principle: 'Elv', check: 'Ellenőrzés', metWhen: 'Mikor teljesül?',
    limitsTitle: 'Korlátok',
    limits: [
      'A katalógus a PhysioNet adatbázisainak egy válogatását tartalmazza, nem minden nyilvános EKG-adatbázist.',
      'A linkeknél csak azt ellenőrizzük, hogy érvényes webcímek-e; azt, hogy elérhetők-e, nem teszteljük automatikusan.',
      'Az annotációszűrő a rögzített annotációleírásban keres kifejezéseket, így egy hiányosan leírt annotáció kimaradhat.',
      'A licenceket a PhysioNeten szereplő formában rögzítjük. Felhasználás előtt mindig olvasd el a licencet.',
    ],
  },
  en: {
    title: 'Methodology',
    containsTitle: 'What the catalog contains',
    contains: (n: number, range: string) => `The catalog describes ${n} open electrocardiogram datasets published on PhysioNet. Every value was taken from the dataset’s official PhysioNet project page and checked against it${range ? ` ${range}` : ''}. The catalog stores metadata only. It does not store or analyse the ECG signals themselves.`,
    range: (from: string, to: string) => `between ${from} and ${to}`,
    storageBefore: 'The verified values are kept in a version-controlled file (',
    storageAfter: '). The web application reads them through a read-only API.',
    language: 'The interface is available in Hungarian and English. Data values (clinical focus, annotations, description, license) are quoted in their original English wording from PhysioNet.',
    rulesTitle: 'Two rules for reading the values',
    rule1Title: 'Records are not subjects',
    rule1: 'A record is one recording. A subject is one person. One person can contribute several records, so the two numbers are stored and shown separately and are never derived from each other.',
    rule2Title: '“Not recorded” means unknown',
    rule2: 'If the official documentation does not state a value, the field stays empty and is shown as “Not recorded”. It is never filled with an estimate or a typical value, and it never counts as meeting a filter.',
    completenessTitle: 'How “Documented” is counted',
    completeness: (n: number) => `For each dataset we check whether these ${n} fields are recorded. The result is reported as a count (for example 15/16), not as a quality score. It measures how well a dataset is documented in this catalog, not the quality of its signals and not whether a recorded value is correct.`,
    group: 'Group', fields: 'Fields', perDataset: 'Result for each dataset', dataset: 'Dataset', documented: 'Documented', missing: 'Not recorded',
    fairTitle: 'Documentation checks related to FAIR',
    fair: 'The FAIR principles (Findable, Accessible, Interoperable, Reusable) describe what makes research data reusable. The dataset page lists a few concrete checks for each principle and reports how many are met. This is a reading aid, not a FAIR certification or assessment.',
    principle: 'Principle', check: 'Check', metWhen: 'Met when',
    limitsTitle: 'Limitations',
    limits: [
      'The catalog covers a selection of PhysioNet datasets, not every public ECG dataset.',
      'Links are checked to be well-formed web addresses. Whether they are still reachable is not tested automatically.',
      'Annotation filters match terms in the recorded annotation description, so a dataset with poorly described annotations may be missed.',
      'Licenses are recorded as stated on PhysioNet. Always read the license before reusing data.',
    ],
  },
}

export default function MethodologyPage({ databases, onOpen }: Props) {
  const { lang, t } = useLang()
  const c = copy[lang]
  const verifiedDates = databases.map((db) => db.last_verified).filter((date): date is string => Boolean(date)).sort()
  const range = verifiedDates.length ? c.range(verifiedDates[0], verifiedDates[verifiedDates.length - 1]) : ''
  const groups = completenessFields.map((field) => field.group).filter((group, index, all) => all.findIndex((other) => other.en === group.en) === index)
  const rows = useMemo(
    () => databases
      .map((db) => ({ db, completeness: getCompleteness(db) }))
      .sort((a, b) => a.completeness.present - b.completeness.present || a.db.name.localeCompare(b.db.name)),
    [databases],
  )

  return (
    <article className="prose">
      <h1>{c.title}</h1>

      <section>
        <h2>{c.containsTitle}</h2>
        <p>{c.contains(databases.length, range)}</p>
        <p>{c.storageBefore}<code>backend/data/catalog.json</code>{c.storageAfter}</p>
        <p>{c.language}</p>
      </section>

      <section>
        <h2>{c.rulesTitle}</h2>
        <dl className="rule-list">
          <dt>{c.rule1Title}</dt>
          <dd>{c.rule1}</dd>
          <dt>{c.rule2Title}</dt>
          <dd>{c.rule2}</dd>
        </dl>
      </section>

      <section>
        <h2>{c.completenessTitle}</h2>
        <p>{c.completeness(completenessFields.length)}</p>
        <div className="table-scroll">
        <table className="data-table compact">
          <thead><tr><th scope="col">{c.group}</th><th scope="col">{c.fields}</th></tr></thead>
          <tbody>
            {groups.map((group) => (
              <tr key={group.en}>
                <th scope="row">{t(group)}</th>
                <td>{completenessFields.filter((field) => field.group.en === group.en).map((field) => t(field.label)).join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        <h3>{c.perDataset}</h3>
        <div className="table-scroll">
          <table className="data-table compact">
            <thead>
              <tr><th scope="col">{c.dataset}</th><th scope="col" className="numeric">{c.documented}</th><th scope="col">{c.missing}</th></tr>
            </thead>
            <tbody>
              {rows.map(({ db, completeness }) => (
                <tr key={db.id}>
                  <td><button type="button" className="dataset-link" onClick={() => onOpen(db.id)}>{db.name}</button></td>
                  <td className="numeric">{completeness.present}/{completeness.total}</td>
                  <td>{completeness.missing.map((field) => t(field.label)).join(', ') || '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>{c.fairTitle}</h2>
        <p>{c.fair}</p>
        <div className="table-scroll">
        <table className="data-table compact">
          <thead><tr><th scope="col">{c.principle}</th><th scope="col">{c.check}</th><th scope="col">{c.metWhen}</th></tr></thead>
          <tbody>
            {fairDefinitions.flatMap((dimension) => dimension.checks.map((check, index) => (
              <tr key={`${dimension.key}-${check.label.en}`}>
                {index === 0 && <th scope="rowgroup" rowSpan={dimension.checks.length}>{t(dimension.name)}</th>}
                <td>{t(check.label)}</td>
                <td>{t(check.evidence)}</td>
              </tr>
            )))}
          </tbody>
        </table>
        </div>
      </section>

      <section>
        <h2>{c.limitsTitle}</h2>
        <ul>
          {c.limits.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>
    </article>
  )
}
