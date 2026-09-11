import { renderHook } from '@testing-library/react'
import i18next from 'i18next'
import type { i18n as I18n } from 'i18next'
import type { ReactNode } from 'react'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import enTranslation from '../../src/i18n/locales/en.json'
import { useRoundCountdown } from '../../src/hooks/use-round-countdown'

const NOW = new Date('2026-01-05T12:00:00Z')
const SECOND_MS = 1000
const MINUTE_MS = 60 * SECOND_MS
const HOUR_MS = 60 * MINUTE_MS

function inMs(ms: number): Date {
  return new Date(NOW.getTime() + ms)
}

function renderCountdown(startTime?: Date, totalMs?: number, instance?: I18n) {
  const wrapper = instance
    ? ({ children }: { children: ReactNode }) => (
        <I18nextProvider i18n={instance}>{children}</I18nextProvider>
      )
    : undefined
  return renderHook(() => useRoundCountdown(startTime, totalMs), { wrapper }).result.current
}

describe(useRoundCountdown, () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns undefined without a start time', () => {
    expect(renderCountdown()).toBeUndefined()
  })

  it('reports the translated pending label once the round is due', () => {
    const countdown = renderCountdown(inMs(0))
    expect(countdown?.isPending).toBeTruthy()
    expect(countdown?.label).toBe('Starting...')
  })

  it('counts down in hours, minutes and seconds', () => {
    expect(renderCountdown(inMs(2 * HOUR_MS))?.label).toBe('in 2 hr.')
    expect(renderCountdown(inMs(5 * MINUTE_MS))?.label).toBe('in 5 min.')
    expect(renderCountdown(inMs(30 * SECOND_MS))?.label).toBe('in 30 sec.')
  })

  it('tracks elapsed time as progress, clamped to the round length', () => {
    expect(renderCountdown(inMs(5 * MINUTE_MS), 10 * MINUTE_MS)?.progress).toBe(50)
    expect(renderCountdown(inMs(-1 * MINUTE_MS), 10 * MINUTE_MS)?.progress).toBe(100)
    expect(renderCountdown(inMs(5 * MINUTE_MS))?.progress).toBe(0)
  })

  it('formats the countdown with the app locale rather than the browser one', async () => {
    const instance = i18next.createInstance()
    await instance.use(initReactI18next).init({
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
      lng: 'es',
      load: 'languageOnly',
      resources: {
        en: { translation: enTranslation },
        es: { translation: { dashboard: { round: { starting: 'Empezando...' } } } }
      },
      supportedLngs: ['en', 'es']
    })
    expect(renderCountdown(inMs(5 * MINUTE_MS), undefined, instance)?.label).toBe('dentro de 5 min')
    expect(renderCountdown(inMs(0), undefined, instance)?.label).toBe('Empezando...')
  })
})
