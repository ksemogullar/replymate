import { tr } from './tr'
import { en } from './en'
import { nl } from './nl'
import type { Locale } from '../locales'

export const translations = {
  tr,
  en,
  nl,
} as const

export type Translations = typeof translations
export type TranslationKey = keyof typeof tr

export function getTranslations(locale: Locale) {
  return translations[locale] || translations.tr
}
