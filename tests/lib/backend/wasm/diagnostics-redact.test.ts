import { describe, expect, it } from 'vitest'
import {
  redactErrorMessage,
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

  it('renders an 8-char fingerprint', () => {
    expect(summarizeValue('1f6f40b2')).toBe('1f6f40b2')
  })

  // The allowlist only renders shapes the bindings actually emit. A short hex
  // run is not one of them, and proves nothing about what it holds.
  it('redacts hex runs that match no emitted id shape', () => {
    expect(summarizeValue('deadbeefcafe')).toBe('<string:12>')
    expect(summarizeValue('a'.repeat(40))).toBe('<string:40>')
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

// The inputs below are bark's own error formats, read verbatim out of
// bark_ffi_wasm_bg.wasm — each interpolates the value that failed to parse.
describe(redactErrorMessage, () => {
  it('keeps the prose so the message stays useful', () => {
    expect(redactErrorMessage('insufficient funds')).toBe('insufficient funds')
  })

  it('redacts an address echoed back by a parse failure', () => {
    const redacted = redactErrorMessage(`Failed to parse address ${ADDRESS}`)
    expect(redacted).not.toContain(ADDRESS)
    expect(redacted).toContain('Failed to parse address')
  })

  it('redacts an invoice echoed back by a parse failure', () => {
    const redacted = redactErrorMessage(`cannot parse invoice ${BOLT11}`)
    expect(redacted).not.toContain(BOLT11)
    expect(redacted).toContain('cannot parse invoice')
  })

  it('redacts an ark address', () => {
    const arkAddress = `ark1${'q'.repeat(60)}`
    expect(redactErrorMessage(`invalid address: ${arkAddress}`)).not.toContain(arkAddress)
  })

  it('redacts a bech32 payload behind the bindings bech32 error', () => {
    const redacted = redactErrorMessage(`Invalid bech32: ${ADDRESS}`)
    expect(redacted).not.toContain(ADDRESS)
  })

  // "mnemonic contains an unknown word (word {})" exists verbatim in the wasm.
  it('redacts a mnemonic word rather than echoing it', () => {
    const redacted = redactErrorMessage('mnemonic contains an unknown word (word abandon)')
    expect(redacted).not.toContain('abandon')
    expect(redacted).toContain('unknown word')
  })

  // A seed pasted into the destination field reaches the error as plain prose,
  // which no shape rule catches — only BIP39 membership does.
  it('redacts a mnemonic carried through as free text', () => {
    const redacted = redactErrorMessage(`Failed to parse address ${MNEMONIC}`)
    expect(redacted).not.toContain('abandon')
    expect(redacted).not.toContain('about')
  })

  it('redacts a realistic 12-word mnemonic', () => {
    const seed = 'legal winner thank year wave sausage worth useful legal winner thank yellow'
    const redacted = redactErrorMessage(`invalid address ${seed}`)
    expect(redacted).not.toContain('sausage')
    expect(redacted).not.toContain('yellow')
  })

  // The wordlist holds common English words, so ordinary error prose must
  // survive or the redaction would eat the messages it exists to preserve.
  it('leaves ordinary error prose untouched', () => {
    const prose = [
      'insufficient funds to cover the requested amount and fee',
      'failed to connect to the ark server, please try again later',
      'transaction rejected by the network because the fee rate is too low',
      'amount is below the dust threshold and cannot be sent',
      'unable to find a vtxo that can cover this payment'
    ]
    for (const message of prose) {
      expect(redactErrorMessage(message)).toBe(message)
    }
  })

  it('redacts long hex blobs such as keys and preimages', () => {
    const preimage = 'c'.repeat(128)
    expect(redactErrorMessage(`invalid preimage ${preimage}`)).not.toContain(preimage)
  })

  it('redacts a base64 PSBT', () => {
    const psbt = `cHNidP${'A'.repeat(120)}`
    expect(redactErrorMessage(`bad psbt ${psbt}`)).not.toContain(psbt)
  })

  // A txid in an error is the most useful thing in the line, and is public.
  it('keeps a txid intact', () => {
    expect(redactErrorMessage(`broadcast failed for ${TXID}`)).toContain(TXID)
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
