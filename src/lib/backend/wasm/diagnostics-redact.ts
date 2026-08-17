// Redaction for diagnostics log entries. The exported log is a file the user
// hands to support, so it is treated as public.
//
// This is an ALLOWLIST by design: a value is rendered only when its shape is
// provably non-sensitive, and anything else becomes a type tag. A denylist would
// leak the first sensitive field nobody thought to exclude. Mnemonics,
// addresses, invoices, offers, LNURLs and PSBTs are never rendered.

// Matches vtxo ids, txids and fingerprints: hex, bounded, useless without the seed.
const HEX_ID = /^[0-9a-f]{8,80}$/iu
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
