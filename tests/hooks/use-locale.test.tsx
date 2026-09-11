import { renderHook } from '@testing-library/react'
import i18next from 'i18next'
import type { i18n as I18n, Resource } from 'i18next'
import type { ReactNode } from 'react'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { describe, expect, it } from 'vitest'
import enTranslation from '../../src/i18n/locales/en.json'
import { useLocale } from '../../src/hooks/use-locale'

const en = { translation: enTranslation }
const es = { translation: { dashboard: { round: { starting: 'Empezando...' } } } }

/** Mirrors the production i18n config, with the detected language pinned. */
async function createI18n(detected: string, resources: Resource): Promise<I18n> {
  const instance = i18next.createInstance()
  await instance.use(initReactI18next).init({
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    lng: detected,
    load: 'languageOnly',
    resources,
    supportedLngs: Object.keys(resources)
  })
  return instance
}

async function renderLocale(detected: string, resources: Resource): Promise<string> {
  const instance = await createI18n(detected, resources)
  const { result } = renderHook(useLocale, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <I18nextProvider i18n={instance}>{children}</I18nextProvider>
    )
  })
  return result.current
}

describe(useLocale, () => {
  it('keeps the detected region when the language is rendered', async () => {
    await expect(renderLocale('en-GB', { en })).resolves.toBe('en-GB')
    await expect(renderLocale('es-MX', { en, es })).resolves.toBe('es-MX')
  })

  it('falls back to the rendered language when the detected one is unsupported', async () => {
    await expect(renderLocale('es-MX', { en })).resolves.toBe('en')
    await expect(renderLocale('fr-FR', { en, es })).resolves.toBe('en')
  })

  it('ignores the detected region when its language has no translations', async () => {
    await expect(renderLocale('es-MX', { en, es: { translation: {} } })).resolves.toBe('en')
  })

  it('rejects a malformed tag that passes supportedLngs on its base language', async () => {
    await expect(renderLocale('en-', { en })).resolves.toBe('en')
    await expect(renderLocale('en-GB-oed', { en })).resolves.toBe('en')
  })

  it('returns a tag every Intl formatter accepts', async () => {
    for (const detected of ['en-', 'en-GB-oed', 'en-GB', 'fr-FR', 'en-Latn-GB']) {
      const locale = await renderLocale(detected, { en })
      expect(() => new Intl.RelativeTimeFormat(locale)).not.toThrow()
      expect(() => new Intl.DateTimeFormat(locale)).not.toThrow()
    }
  })

  it('formats dates in the detected region rather than the language default', async () => {
    const locale = await renderLocale('en-GB', { en })
    const formatted = new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC'
    }).format(new Date('2026-01-05T15:04:00Z'))
    expect(formatted).toContain('5 Jan 2026')
    expect(formatted).toContain('15:04')
  })
})
