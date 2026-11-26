/** Az alkalmazás köré tett szolgáltató: tárolja a választott nyelvet, és beállítja a <html lang> attribútumot. */
import { useEffect, useState, type ReactNode } from 'react'
import { readStoredLang, storeLang, type Lang } from './lang.ts'
import { LangContext } from './useLang.ts'

export default function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = (next: Lang) => {
    setLangState(next)
    storeLang(next)
  }

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>
}
