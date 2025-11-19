"use client"

import { createContext, useContext, useEffect, useMemo, useState } from 'react'

import { DEFAULT_LOCALE, Locale, SUPPORTED_LOCALES } from '@/lib/i18n/locales'

type LocaleContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
})

const STORAGE_KEY = 'replymate_locale'

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (saved && SUPPORTED_LOCALES.includes(saved as Locale)) {
      setLocaleState(saved as Locale)
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, locale)
      document.documentElement.lang = locale === 'tr' ? 'tr' : locale === 'nl' ? 'nl' : 'en'
    }
  }, [locale])

  const value = useMemo(() => ({
    locale,
    setLocale: (next: Locale) => {
      setLocaleState(next)
    },
  }), [locale])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  return useContext(LocaleContext)
}
