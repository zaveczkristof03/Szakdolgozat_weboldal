/**
 * Kétnyelvű felület (magyar / angol) – az alapok.
 *
 * Hogyan működik? Minden felirat egy `{ hu: '…', en: '…' }` objektum (Text típus).
 * A komponensek a `useLang()` hook `t()` függvényével kérik el az aktuális nyelvű
 * változatot. A választott nyelvet a böngésző megjegyzi (localStorage).
 *
 * Az adatértékek (kategória, annotáció, leírás, licenc) NEM fordulnak: azok a
 * PhysioNet eredeti, angol nyelvű szövegei, így pontosan idézik a forrást.
 */
export type Lang = 'hu' | 'en'
export type Text = Record<Lang, string>

export const LANGS: Lang[] = ['hu', 'en']
export const DEFAULT_LANG: Lang = 'hu'
export const LANG_STORAGE_KEY = 'ekg-lang'

export const parseLang = (value: string | null | undefined): Lang => (value === 'en' || value === 'hu' ? value : DEFAULT_LANG)

export function readStoredLang(): Lang {
  try {
    return parseLang(window.localStorage.getItem(LANG_STORAGE_KEY))
  } catch {
    return DEFAULT_LANG
  }
}

export function storeLang(lang: Lang): void {
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang)
  } catch {
    // Ha a böngésző tiltja a tárolást, a választás csak az aktuális munkamenetre él.
  }
}
