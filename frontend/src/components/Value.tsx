/**
 * Egy metaadat-érték megjelenítése. Ha az érték hiányzik, látható "Not recorded"
 * jelölést kap (halványabb stílussal) – a hiány soha nem tűnik el csendben.
 */
import { formatOptional, hasText } from '../domain/format.ts'

export default function Value({ value, unit = '' }: { value: unknown; unit?: string }) {
  return hasText(value)
    ? <>{formatOptional(value, unit)}</>
    : <span className="value-missing">{formatOptional(value)}</span>
}
