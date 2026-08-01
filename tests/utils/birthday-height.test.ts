import type { ChainSourceConfig } from '@secondts/barkd'
import { describe, expect, it } from 'vitest'
import {
  BIRTHDAY_HEIGHT_REQUIRED,
  birthdayHeightSchema,
  birthdayHeightSchemaFor,
  requiresBirthdayHeight
} from '../../src/utils/birthday-height'

const ABSENT: unknown = undefined

const ESPLORA: ChainSourceConfig = { esplora: { url: 'https://esplora.example.com' } }
const BITCOIND: ChainSourceConfig = {
  bitcoind: {
    bitcoind: '127.0.0.1:38332',
    bitcoindAuth: { cookie: { cookie: '/root/.bitcoin/.cookie' } }
  }
}

describe('birthday height field schema', () => {
  it('treats an untouched input as absent', () => {
    expect(birthdayHeightSchema.parse('')).toBeUndefined()
  })

  it.each(['   ', '\t'])('treats whitespace-only input %j as absent', (value) => {
    expect(birthdayHeightSchema.parse(value)).toBeUndefined()
  })

  it('treats an absent value as absent', () => {
    expect(birthdayHeightSchema.parse(ABSENT)).toBeUndefined()
  })

  it('coerces the string a number input yields', () => {
    expect(birthdayHeightSchema.parse('850000')).toBe(850_000)
  })

  it('accepts a number as-is', () => {
    expect(birthdayHeightSchema.parse(850_000)).toBe(850_000)
  })

  it.each(['0', '-1', '1.5', 'abc'])('rejects %s', (value) => {
    expect(birthdayHeightSchema.safeParse(value).success).toBeFalsy()
  })
})

describe('birthday height requiredness per chain source', () => {
  it('is required on bitcoind', () => {
    expect(requiresBirthdayHeight(BITCOIND)).toBeTruthy()
  })

  it('is optional on esplora', () => {
    expect(requiresBirthdayHeight(ESPLORA)).toBeFalsy()
  })

  it.each(['', '   '])('rejects blank input %j on bitcoind', (value) => {
    const result = birthdayHeightSchemaFor(() => BITCOIND).safeParse(value)
    expect(result.success).toBeFalsy()
    expect(result.error?.issues[0]?.message).toBe(BIRTHDAY_HEIGHT_REQUIRED)
  })

  it('accepts a filled value on bitcoind', () => {
    expect(birthdayHeightSchemaFor(() => BITCOIND).parse('850000')).toBe(850_000)
  })

  it('still accepts blank input on esplora', () => {
    expect(birthdayHeightSchemaFor(() => ESPLORA).parse('')).toBeUndefined()
  })

  // The schema is built at module scope, before `initConfig()` runs, so the
  // chain source must only be read when a value is parsed.
  it('reads the chain source at parse time, not at construction', () => {
    let chainSource: ChainSourceConfig = ESPLORA
    const schema = birthdayHeightSchemaFor(() => chainSource)
    expect(schema.parse('')).toBeUndefined()
    chainSource = BITCOIND
    expect(schema.safeParse('').success).toBeFalsy()
  })
})
