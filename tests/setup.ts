import '@testing-library/jest-dom/vitest'
import { BarkNetwork, Configuration } from '@secondts/barkd'
import { cleanup } from '@testing-library/react'
import * as i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import { afterEach, vi } from 'vitest'
import { __setRuntimeConfigForTests } from '../src/config/barkd'
import enTranslation from '../public/locales/en.json'

__setRuntimeConfigForTests({
  arkServer: 'http://localhost:3535',
  chainSource: 'http://localhost:18443',
  client: new Configuration({ basePath: '/api/barkd' }),
  network: BarkNetwork.Signet,
  walletDataPath: '/data/.bark/'
})

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: (query: string) => ({
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    dispatchEvent: vi.fn(),
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: vi.fn(),
    removeListener: vi.fn()
  }),
  writable: true
})

vi.stubGlobal(
  'ResizeObserver',
  vi.fn(() => ({
    disconnect: vi.fn(),
    observe: vi.fn(),
    unobserve: vi.fn()
  }))
)

vi.stubGlobal(
  'IntersectionObserver',
  vi.fn(() => ({
    disconnect: vi.fn(),
    observe: vi.fn(),
    root: null,
    rootMargin: '',
    takeRecords: vi.fn(() => []),
    thresholds: [],
    unobserve: vi.fn()
  }))
)

if (!i18next.default.isInitialized) {
  void i18next.default.use(initReactI18next).init({
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    lng: 'en',
    resources: { en: { translation: enTranslation } }
  })
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
})
