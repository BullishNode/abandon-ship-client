import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import * as i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import { afterEach, vi } from 'vitest'
import { __setRuntimeConfigForTests } from '../src/config/runtime'
import enTranslation from '../src/i18n/locales/en.json'

__setRuntimeConfigForTests({
  arkServer: 'http://localhost:3535',
  chainSource: { esplora: { url: 'http://localhost:18443' } },
  network: 'signet',
  walletDataPath: '/data/.bark/'
})

// Guarded so this shared setup also runs under the `node` test environment
// (used by backend/proxy tests), where `window` and the storage globals are absent.
const hasDom = typeof window !== 'undefined'

if (hasDom) {
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
}

// Constructible stub: components call `new ResizeObserver(...)`, which an
// arrow-function mock cannot satisfy.
class ObserverStub {
  root = null
  rootMargin = ''
  thresholds = []
  disconnect = vi.fn()
  observe = vi.fn()
  takeRecords = vi.fn(() => [])
  unobserve = vi.fn()
}

vi.stubGlobal('ResizeObserver', ObserverStub)
vi.stubGlobal('IntersectionObserver', ObserverStub)

if (!i18next.default.isInitialized) {
  void i18next.default.use(initReactI18next).init({
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    lng: 'en',
    resources: { en: { translation: enTranslation } }
  })
}

afterEach(() => {
  if (hasDom) {
    cleanup()
    localStorage.clear()
    sessionStorage.clear()
  }
})
