import { describe, expect, it } from 'vitest'
import {
  summarizeArgs,
  summarizeResult,
  summarizeValue
} from '@/lib/backend/wasm/diagnostics-redact'

const TXID = 'a'.repeat(64)
// What a void RPC method (refreshVtxos, startExitForVtxos) resolves to.
const VOID_RESULT: unknown = Reflect.get({}, 'missing')
const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon about'
const BOLT11 = `lnbc1${'q'.repeat(200)}`
const ADDRESS = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'

describe(summarizeValue, () => {
  it('renders numbers and booleans verbatim', () => {
    expect(summarizeValue(21_000)).toBe('21000')
    expect(summarizeValue(true)).toBe('true')
  })

  it('renders hex ids in full', () => {
    expect(summarizeValue(TXID)).toBe(TXID)
  })

  it('redacts mnemonics, invoices and addresses', () => {
    expect(summarizeValue(MNEMONIC)).toBe(`<string:${MNEMONIC.length}>`)
    expect(summarizeValue(BOLT11)).toBe(`<string:${BOLT11.length}>`)
    expect(summarizeValue(ADDRESS)).toBe(`<string:${ADDRESS.length}>`)
  })

  it('never leaks a mnemonic word', () => {
    expect(summarizeValue(MNEMONIC)).not.toContain('abandon')
  })

  it('distinguishes an empty string from a redacted one', () => {
    expect(summarizeValue('')).toBe("''")
  })

  it('renders id arrays but collapses other arrays to a count', () => {
    expect(summarizeValue([TXID])).toBe(`[${TXID}]`)
    expect(summarizeValue([ADDRESS, ADDRESS])).toBe('<array:2>')
  })

  it('renders only allowlisted object keys', () => {
    const summary = summarizeValue({ address: ADDRESS, amountSats: 500 })
    expect(summary).toBe('{ amountSats: 500 }')
    expect(summary).not.toContain(ADDRESS)
  })

  it('renders a type discriminant verbatim rather than by length', () => {
    expect(summarizeValue({ type: 'MovementCreated' })).toBe('{ type: MovementCreated }')
  })

  it('tags an object with no allowlisted keys', () => {
    expect(summarizeValue({ invoice: BOLT11 })).toBe('<object>')
  })

  it('tags Comlink callback proxies', () => {
    expect(summarizeValue(() => 'ignored')).toBe('<fn>')
  })
})

describe(summarizeArgs, () => {
  it('joins rendered arguments', () => {
    expect(summarizeArgs([ADDRESS, 1000])).toBe(`<string:${ADDRESS.length}>, 1000`)
  })

  it('returns an empty string for a no-argument call', () => {
    expect(summarizeArgs([])).toBe('')
  })

  it('caps the number of rendered arguments', () => {
    expect(summarizeArgs([1, 2, 3, 4, 5, 6])).toBe('1, 2, 3, 4')
  })
})

describe(summarizeResult, () => {
  it('renders a returned txid', () => {
    expect(summarizeResult(TXID)).toBe(TXID)
  })

  it('renders a payment status type', () => {
    expect(summarizeResult({ type: 'paid' })).toBe('{ type: paid }')
  })

  it('yields an empty summary for void and opaque results', () => {
    expect(summarizeResult(VOID_RESULT)).toBe('')
    expect(summarizeResult({ invoice: BOLT11 })).toBe('')
  })
})
