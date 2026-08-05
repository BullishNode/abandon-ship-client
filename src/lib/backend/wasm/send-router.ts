import { z } from 'zod'

// barkd exposed one `send` endpoint that classified the destination and routed
// it server-side. WASM has no router, so destination parsing and (for
// LNURL / lightning-address) invoice resolution move client-side. The worker
// then executes the concrete primitive (arkoor / bolt11 / bolt12).

export type SendKind = 'ark' | 'bolt11' | 'bolt12' | 'lnurl' | 'lightning-address'

const BOLT11_PATTERN = /^ln(bc|tb|bcrt|sb)/iu
const BOLT12_PATTERN = /^lno/iu
const LNURL_PATTERN = /^lnurl/iu
const LIGHTNING_ADDRESS_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/u
const MSAT_PER_SAT = 1000

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

// Remote LNURL responses are money-path input: validate them instead of
// trusting the endpoint's JSON shape (a missing minSendable/maxSendable would
// otherwise silently pass the range comparisons below).
const lnurlPayParamsSchema = z.object({
  callback: z.url(),
  commentAllowed: z.number().optional(),
  maxSendable: z.number(),
  minSendable: z.number(),
  tag: z.literal('payRequest')
})

const lnurlPayInvoiceSchema = z.object({
  pr: z.string().min(1)
})

function lightningAddressToUrl(address: string): URL {
  const [user, domain] = address.split('@')
  // URL-encode the user part and let the URL constructor reject a domain that
  // is not a plain host, so a crafted "address" cannot steer the request path.
  // Hosts are case-insensitive (URL lowercases them); compare accordingly.
  const url = new URL(`https://${domain}`)
  if (url.host !== domain.toLowerCase()) {
    throw new Error('Invalid lightning address')
  }
  url.pathname = `/.well-known/lnurlp/${encodeURIComponent(user)}`
  return url
}

async function fetchJson(url: URL): Promise<unknown> {
  // LUD-01 mandates https; a downgraded callback would leak the payment
  // request in cleartext.
  if (url.protocol !== 'https:') {
    throw new Error('LNURL endpoints must use https')
  }
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`LNURL request failed: ${response.status}`)
  }
  return await response.json()
}

// Resolve a lightning-address to a bolt11 invoice for `amountSats` via the
// LNURL-pay flow. Requires the LNURL endpoint to allow browser-direct requests
// (CORS); if it does not, the fetch rejects and the send surfaces the error.
async function resolveLightningAddress(
  address: string,
  amountSats: number,
  comment: string | null | undefined
): Promise<string> {
  const params = lnurlPayParamsSchema.parse(await fetchJson(lightningAddressToUrl(address)))
  const amountMsat = amountSats * MSAT_PER_SAT
  if (amountMsat < params.minSendable || amountMsat > params.maxSendable) {
    throw new Error('Amount is outside the recipient’s accepted range')
  }
  const callback = new URL(params.callback)
  callback.searchParams.set('amount', String(amountMsat))
  // LUD-12: attach the comment only when the service accepts one of this
  // length; services that never advertised commentAllowed may reject unknown
  // params, so silently dropping matches barkd's best-effort behavior.
  const sendComment =
    typeof comment === 'string' &&
    comment.length > 0 &&
    params.commentAllowed !== undefined &&
    comment.length <= params.commentAllowed
  if (sendComment) {
    callback.searchParams.set('comment', comment)
  }
  const invoice = lnurlPayInvoiceSchema.parse(await fetchJson(callback))
  return invoice.pr
}

export async function resolveToInvoice(
  destination: string,
  kind: SendKind,
  amountSats: number | null | undefined,
  comment: string | null | undefined
): Promise<string> {
  if (amountSats === null || amountSats === undefined) {
    throw new Error('An amount is required to pay a lightning address')
  }
  if (kind === 'lightning-address') {
    return await resolveLightningAddress(destination.trim(), amountSats, comment)
  }
  throw new Error('LNURL sends are not supported in WASM mode yet')
}
