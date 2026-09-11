import { useTranslation } from 'react-i18next'

const FALLBACK_LOCALE = 'en'

/**
 * `Intl` constructors throw a `RangeError` on a malformed BCP 47 tag, and the
 * language detector reads one straight from `?lng=` and caches it in
 * localStorage, so a tag that only looks supported (`en-` passes `supportedLngs`
 * on its `en` base) must never reach a formatter.
 */
function isWellFormedLocale(locale: string): boolean {
  try {
    Intl.getCanonicalLocales(locale)
    return true
  } catch {
    return false
  }
}

/**
 * BCP 47 locale for `Intl` formatters.
 *
 * `resolvedLanguage` is the language actually rendered, but `load:
 * 'languageOnly'` strips its region, which would hand every English speaker US
 * date order. `i18n.language` keeps the detected region and is already narrowed
 * to a supported language by `supportedLngs`, so prefer it whenever it matches
 * what is rendered and is a tag `Intl` accepts.
 */
export function useLocale(): string {
  const { i18n } = useTranslation()
  const resolved = i18n.resolvedLanguage
  if (resolved === undefined) {
    return isWellFormedLocale(i18n.language) ? i18n.language : FALLBACK_LOCALE
  }
  const [base] = i18n.language.split('-')
  const preferred = base.toLowerCase() === resolved.toLowerCase() ? i18n.language : resolved
  return isWellFormedLocale(preferred) ? preferred : resolved
}
