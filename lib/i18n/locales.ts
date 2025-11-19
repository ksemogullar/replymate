export type Locale = 'tr' | 'en' | 'nl'

export const SUPPORTED_LOCALES: Locale[] = ['tr', 'en', 'nl']
export const DEFAULT_LOCALE: Locale = 'tr'

export const localeLabels: Record<Locale, string> = {
  tr: 'Türkçe',
  en: 'English',
  nl: 'Nederlands',
}

// Placeholder translation buckets. Individual pages/components can extend this.
export const COMMON_TRANSLATIONS = {
  tr: {
    auth: {
      login: 'Giriş Yap',
      signup: 'Kayıt Ol',
    },
  },
  en: {
    auth: {
      login: 'Log In',
      signup: 'Sign Up',
    },
  },
  nl: {
    auth: {
      login: 'Inloggen',
      signup: 'Registreren',
    },
  },
} as const

export type CommonTranslations = typeof COMMON_TRANSLATIONS[Locale]

export function getCommonTranslations(locale: Locale): CommonTranslations {
  return COMMON_TRANSLATIONS[locale] || COMMON_TRANSLATIONS[DEFAULT_LOCALE]
}
