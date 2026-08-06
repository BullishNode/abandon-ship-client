// barkd exposes one `send` endpoint that classifies the destination and routes
// it server-side. WASM has no router, so destination parsing happens
// client-side and the worker executes the concrete primitive (arkoor / bolt11
// / bolt12 / LNURL-pay via the bindings).

export type SendKind = 'ark' | 'bolt11' | 'bolt12' | 'lnurl' | 'lightning-address'

const BOLT11_PATTERN = /^ln(bc|tb|bcrt|sb)/iu
const BOLT12_PATTERN = /^lno/iu
const LNURL_PATTERN = /^lnurl/iu
const LIGHTNING_ADDRESS_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/u

export function classifyDestination(destination: string): SendKind {
  const trimmed = destination.trim()
  if (LIGHTNING_ADDRESS_PATTERN.test(trimmed)) {
    return 'lightning-address'
  }
  if (LNURL_PATTERN.test(trimmed)) {
    return 'lnurl'
  }
  if (BOLT12_PATTERN.test(trimmed)) {
    return 'bolt12'
  }
  if (BOLT11_PATTERN.test(trimmed)) {
    return 'bolt11'
  }
  return 'ark'
}
