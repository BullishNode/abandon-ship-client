import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateUuid } from '../../src/lib/uuid'

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
const SAMPLE_SIZE = 1000

function stubInsecureContextCrypto() {
  const getRandomValues = crypto.getRandomValues.bind(crypto)
  vi.stubGlobal('crypto', { getRandomValues })
}

describe(generateUuid, () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses crypto.randomUUID when available', () => {
    const native = '01234567-89ab-4cde-8f01-23456789abcd'
    vi.stubGlobal('crypto', {
      getRandomValues: crypto.getRandomValues.bind(crypto),
      randomUUID: vi.fn<() => string>(() => native)
    })
    expect(generateUuid()).toBe(native)
    expect(crypto.randomUUID).toHaveBeenCalledOnce()
  })

  it('falls back when crypto.randomUUID is unavailable', () => {
    stubInsecureContextCrypto()
    expect(generateUuid()).toMatch(UUID_V4_PATTERN)
  })

  it('always produces version 4 and RFC 4122 variant in fallback', () => {
    stubInsecureContextCrypto()
    for (let i = 0; i < SAMPLE_SIZE; i += 1) {
      expect(generateUuid()).toMatch(UUID_V4_PATTERN)
    }
  })

  it('produces unique values in fallback', () => {
    stubInsecureContextCrypto()
    const seen = new Set<string>()
    for (let i = 0; i < SAMPLE_SIZE; i += 1) {
      seen.add(generateUuid())
    }
    expect(seen.size).toBe(SAMPLE_SIZE)
  })
})
