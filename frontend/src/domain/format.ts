/** Kis segédfüggvények a megjelenítéshez. Egy helyen, hogy minden oldal ugyanúgy formázzon. */
import type { Lang, Text } from '../i18n/lang.ts'

/** A hiányzó érték jelölése. Soha nem helyettesítjük becsült értékkel. */
export const NOT_RECORDED: Text = { hu: 'Nincs adat', en: 'Not recorded' }

const NUMBER_LOCALE: Record<Lang, string> = { hu: 'hu-HU', en: 'en-US' }

export const hasText = (value: unknown): boolean =>
  value !== null && value !== undefined && String(value).trim().length > 0

export const text = (value: unknown): string => (hasText(value) ? String(value).trim() : '')

export const formatNumber = (value: number, lang: Lang = 'hu'): string => value.toLocaleString(NUMBER_LOCALE[lang])

/** Hiányzó értéknél "Nincs adat" / "Not recorded", számnál ezres tagolás, egységgel ha kell. */
export function formatOptional(value: unknown, unit = '', lang: Lang = 'hu'): string {
  if (!hasText(value)) return NOT_RECORDED[lang]
  const shown = typeof value === 'number' ? formatNumber(value, lang) : String(value).trim()
  return unit ? `${shown} ${unit}` : shown
}

/** Csak http(s) linket engedünk megnyitni (pl. `javascript:` linket nem). */
export function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null
  } catch {
    return null
  }
}

/** A PhysioNet LightWAVE nézőjének címe – csak igazolt azonosítóval jelenik meg. */
export const lightwaveUrl = (databaseId: string | null | undefined): string | null =>
  databaseId ? `https://physionet.org/lightwave/?db=${encodeURIComponent(databaseId)}` : null

export const doiUrl = (doi: string | null | undefined): string | null =>
  doi ? `https://doi.org/${doi}` : null
