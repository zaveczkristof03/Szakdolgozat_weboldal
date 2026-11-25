/**
 * Egy metaadat-érték megjelenítése. Ha az érték hiányzik, látható „Nincs adat” /
 * „Not recorded” jelölést kap (halványabb stílussal) – a hiány soha nem tűnik el csendben.
 */
import { formatOptional, hasText } from '../domain/format.ts'
import { useLang } from '../i18n/useLang.ts'

export default function Value({ value, unit = '' }: { value: unknown; unit?: string }) {
  const { lang } = useLang()
  return hasText(value)
    ? <>{formatOptional(value, unit, lang)}</>
    : <span className="value-missing">{formatOptional(value, '', lang)}</span>
}
