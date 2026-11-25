/** A nyelvi környezet (React context) és az ezt olvasó `useLang()` hook. */
import { createContext, useContext } from 'react'
import { DEFAULT_LANG, type Lang, type Text } from './lang.ts'

export type LangContextValue = { lang: Lang; setLang: (lang: Lang) => void }

export const LangContext = createContext<LangContextValue>({ lang: DEFAULT_LANG, setLang: () => undefined })

export function useLang() {
  const { lang, setLang } = useContext(LangContext)
  const t = (text: Text) => text[lang]
  return { lang, setLang, t }
}
