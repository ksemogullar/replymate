import { useLocale } from '@/context/LocaleContext'
import { getTranslations } from './translations'

export function useTranslation() {
  const { locale } = useLocale()
  const t = getTranslations(locale)

  return { t, locale }
}
