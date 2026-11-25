/**
 * A jobb oldali oszlop tartalma, amíg nincs kiválasztott adatbázis (csak nagy képernyőn).
 * Csak a katalógusból számolt, ellenőrizhető tényeket mutat – nincs díszítő statisztika.
 */
import { completenessFields, getCompleteness } from '../../domain/completeness.ts'
import type { ECGDatabase } from '../../domain/types.ts'
import { s } from '../../i18n/strings.ts'
import { useLang } from '../../i18n/useLang.ts'

export default function CatalogOverview({ databases }: { databases: ECGDatabase[] }) {
  const { t } = useLang()
  const dates = databases.map((db) => db.last_verified).filter((date): date is string => Boolean(date)).sort()
  const profiles = databases.map(getCompleteness)
  const complete = profiles.filter((profile) => profile.present === profile.total).length
  const missingCounts = completenessFields
    .map((field) => ({ field, count: profiles.filter((profile) => profile.missing.some((missing) => missing.key === field.key)).length }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count)

  return (
    <section className="detail-panel detail-panel-empty" aria-labelledby="overview-title">
      <div className="detail-panel-heading">
        <h2 id="overview-title">{t(s.overview.title)}</h2>
      </div>
      <div className="detail-panel-body">
        <p className="overview-hint">{t(s.overview.hint)}</p>
        <section className="detail-section">
          <h3>{t(s.overview.aboutTitle)}</h3>
          <dl className="fact-list">
            <div><dt>{t(s.overview.datasets)}</dt><dd>{t(s.overview.datasetsValue(databases.length))}</dd></div>
            {dates.length > 0 && <div><dt>{t(s.overview.verified)}</dt><dd>{dates[0]} – {dates[dates.length - 1]}</dd></div>}
            <div><dt>{t(s.overview.complete)}</dt><dd>{t(s.overview.completeValue(complete, databases.length, completenessFields.length))}</dd></div>
            {missingCounts.map(({ field, count }) => (
              <div key={field.key}><dt>{t(s.overview.missing)}: {t(field.label)}</dt><dd>{t(s.overview.missingValue(count))}</dd></div>
            ))}
          </dl>
          <p className="footnote">{t(s.overview.more)} <a href="#/methodology">{t(s.app.pages.methodology)}</a>.</p>
        </section>
      </div>
    </section>
  )
}
