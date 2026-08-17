import { wordlist } from '@scure/bip39/wordlists/english.js'

// Redaction for diagnostics log entries. The exported log is a file the user
// hands to support, so it is treated as public.
//
// This is an ALLOWLIST by design: a value is rendered only when its shape is
// provably non-sensitive, and anything else becomes a type tag. A denylist would
// leak the first sensitive field nobody thought to exclude. Mnemonics,
// addresses, invoices, offers, LNURLs and PSBTs are never rendered.

// Matches only the id shapes the bindings actually emit: an 8-char fingerprint,
// or a 64-char txid/vtxo id (66 with a vout suffix). Deliberately not a general
// "looks like hex" test — a short hex run proves nothing about its contents, and
// the allowlist only renders values whose shape is provably non-sensitive.
const HEX_ID = /^(?:[0-9a-f]{8}|[0-9a-f]{64,66})$/u
const MAX_ARGS_RENDERED = 4

function isHexId(value: string): boolean {
  return HEX_ID.test(value)
}

// Only hex ids survive; other strings collapse to a length so support can still
// distinguish an empty destination from a populated one.
function summarizeString(value: string): string {
  if (value.length === 0) {
    return "''"
  }
  if (isHexId(value)) {
    return value
  }
  return `<string:${value.length}>`
}

function summarizeArray(value: readonly unknown[]): string {
  const allHexIds = value.every((item) => typeof item === 'string' && isHexId(item))
  if (allHexIds && value.length > 0 && value.length <= MAX_ARGS_RENDERED) {
    return `[${value.join(', ')}]`
  }
  return `<array:${value.length}>`
}

// Object fields worth rendering. Allowlisted by name, so a field added upstream
// (a new address or invoice property) is dropped until it is reviewed here.
const RENDERED_OBJECT_KEYS = new Set([
  'amountSats',
  'createIfNotExists',
  'feeRateSatPerVb',
  'ongoing',
  'runDaemon',
  'txid',
  'type',
  'vtxoIds'
])

// Discriminants ('paid', 'MovementCreated') are closed enums from the bindings,
// never user data, and are the single most useful field in a log line — so they
// bypass the string-length redaction that would reduce them to '<string:4>'.
const VERBATIM_OBJECT_KEYS = new Set(['type'])

function summarizeObject(value: object, summarize: (inner: unknown) => string): string {
  const parts: string[] = []
  for (const key of Object.keys(value)) {
    if (!RENDERED_OBJECT_KEYS.has(key)) {
      continue
    }
    const inner = Reflect.get(value, key)
    if (inner === undefined) {
      continue
    }
    const rendered =
      VERBATIM_OBJECT_KEYS.has(key) && typeof inner === 'string' ? inner : summarize(inner)
    parts.push(`${key}: ${rendered}`)
  }
  return parts.length > 0 ? `{ ${parts.join(', ')} }` : '<object>'
}

export function summarizeValue(value: unknown): string {
  if (value === null) {
    return 'null'
  }
  if (value === undefined) {
    return 'undefined'
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (typeof value === 'string') {
    return summarizeString(value)
  }
  if (Array.isArray(value)) {
    return summarizeArray(value)
  }
  if (typeof value === 'function') {
    return '<fn>'
  }
  if (typeof value === 'object') {
    return summarizeObject(value, summarizeValue)
  }
  return `<${typeof value}>`
}

export function summarizeArgs(args: readonly unknown[]): string {
  return args.slice(0, MAX_ARGS_RENDERED).map(summarizeValue).join(', ')
}

// Error text is the one value that cannot be allowlisted: the message IS the
// signal, so it has to be rendered. bark's errors are Rust format strings that
// interpolate the offending input — the wasm binary contains, verbatim:
//
//   "Failed to parse address"        "Invalid bech32: "
//   "cannot parse invoice"           "invalid user amount: invoice=, user="
//   "mnemonic contains an unknown word (word )"
//
// So a rejected send would otherwise log the destination the argument redaction
// just stripped. This scrubs the secret-shaped runs and keeps the prose.
//
// Covers bech32 (addresses, invoices, offers, LNURLs), long hex (keys,
// preimages) and base64 (PSBTs). The hex bound sits deliberately above the
// 66-char id shape above, so a txid quoted in an error still survives.
const BECH32_LIKE = /\b[a-z]{2,6}1[02-9ac-hj-np-z]{20,}\b/giu
const LONG_HEX = /\b[0-9a-f]{67,}\b/giu
const BASE64_BLOB = /\b[A-Za-z0-9+/]{80,}={0,2}/gu

// Mnemonic words are ordinary lowercase words, so they cannot be matched by
// shape. bark's BIP39 error interpolates a single word; drop the parenthetical
// rather than trying to identify it.
const MNEMONIC_WORD = /\bunknown word \([^)]*\)/giu

// A seed pasted into a destination field reaches an error as plain prose, which
// no shape rule can catch. Membership in the BIP39 list can: a run of
// consecutive wordlist words is a seed, not a sentence. The threshold is well
// above what English prose strings together by chance ("above absent above" is
// not a sentence) and well below the shortest 12-word mnemonic.
const MNEMONIC_RUN_LENGTH = 6
const WORD_RUN = /\b[a-z]{3,8}(?:\s+[a-z]{3,8})+\b/giu
const BIP39_WORDS = new Set(wordlist)

function redactMnemonicRuns(message: string): string {
  return message.replace(WORD_RUN, (run) => {
    const words = run.split(/\s+/u)
    let streak = 0
    for (const word of words) {
      streak = BIP39_WORDS.has(word) ? streak + 1 : 0
      if (streak >= MNEMONIC_RUN_LENGTH) {
        return '<redacted>'
      }
    }
    return run
  })
}

export function redactErrorMessage(message: string): string {
  return redactMnemonicRuns(
    message
      .replace(MNEMONIC_WORD, 'unknown word (<redacted>)')
      .replace(BECH32_LIKE, '<redacted>')
      .replace(BASE64_BLOB, '<redacted>')
      .replace(LONG_HEX, '<redacted>')
  )
}

// Tighter than summarizeArgs: the useful signal is a txid or payment status,
// not the whole payload.
export function summarizeResult(result: unknown): string {
  if (result === undefined || result === null) {
    return ''
  }
  if (typeof result === 'string') {
    return summarizeString(result)
  }
  if (typeof result === 'object' && !Array.isArray(result)) {
    const summary = summarizeObject(result, summarizeValue)
    return summary === '<object>' ? '' : summary
  }
  return summarizeValue(result)
}
