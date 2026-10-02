// The proxy forwards `/api/barkd/*` to barkd with the process's bearer token, so
// every reachable route is effectively unauthenticated from the browser. Rather
// than blocklisting the one sensitive route (which has to anticipate every
// encoding both frameworks normalize differently), we allowlist the exact set of
// routes the app's generated barkd client can call, minus `/api/v1/wallet/mnemonic`
// — the seed is served only through the session-guarded `/api/reveal-mnemonic`
// endpoint. Anything not on the list fails closed with a 404.
//
// Keep this list in sync with the `@secondts/barkd` client: it is the set of
// `urlPath` values that package emits, with `{param}` segments generalized and the
// mnemonic route removed. `/ping` is barkd's liveness route and is intentionally
// kept.
const ALLOWED_BARKD_ROUTES = [
  '/ping',
  '/api/v1/bitcoin/tip',
  '/api/v1/boards/board-all',
  '/api/v1/boards/board-amount',
  '/api/v1/boards/pending',
  '/api/v1/exits/cancel/{param}',
  '/api/v1/exits/claim/all',
  '/api/v1/exits/claim/vtxos',
  '/api/v1/exits/fee',
  '/api/v1/exits/progress',
  '/api/v1/exits/start/all',
  '/api/v1/exits/start/vtxos',
  '/api/v1/exits/status',
  '/api/v1/exits/status/{param}',
  '/api/v1/exits/status/all',
  '/api/v1/exits/status/finished',
  '/api/v1/exits/status/live',
  '/api/v1/exits/status/vtxo/{param}',
  '/api/v1/fees/board',
  '/api/v1/fees/lightning/pay',
  '/api/v1/fees/lightning/receive',
  '/api/v1/fees/offboard',
  '/api/v1/fees/offboard-all',
  '/api/v1/fees/onchain',
  '/api/v1/fees/send-onchain',
  '/api/v1/history',
  '/api/v1/history/{param}/metadata',
  '/api/v1/lightning/pay',
  '/api/v1/lightning/receives',
  '/api/v1/lightning/receives/{param}',
  '/api/v1/lightning/receives/invoice',
  '/api/v1/lightning/receives/invoice/for-address',
  '/api/v1/lightning/sends/{param}',
  '/api/v1/message/sign',
  '/api/v1/message/verify',
  '/api/v1/notifications/wait',
  '/api/v1/notifications/ws/ticket',
  '/api/v1/onchain/addresses/next',
  '/api/v1/onchain/balance',
  '/api/v1/onchain/drain',
  '/api/v1/onchain/send',
  '/api/v1/onchain/send-many',
  '/api/v1/onchain/sync',
  '/api/v1/onchain/transactions',
  '/api/v1/onchain/utxos',
  '/api/v1/wallet',
  '/api/v1/wallet/addresses/index/{param}',
  '/api/v1/wallet/addresses/next',
  '/api/v1/wallet/ark-info',
  '/api/v1/wallet/balance',
  '/api/v1/wallet/bip321',
  '/api/v1/wallet/connected',
  '/api/v1/wallet/create',
  '/api/v1/wallet/history',
  '/api/v1/wallet/import-vtxo',
  '/api/v1/wallet/movements',
  '/api/v1/wallet/next-round',
  '/api/v1/wallet/offboard/all',
  '/api/v1/wallet/offboard/vtxos',
  '/api/v1/wallet/refresh/all',
  '/api/v1/wallet/refresh/counterparty',
  '/api/v1/wallet/refresh/delegated/vtxos',
  '/api/v1/wallet/refresh/vtxos',
  '/api/v1/wallet/rounds',
  '/api/v1/wallet/send',
  '/api/v1/wallet/send-onchain',
  '/api/v1/wallet/sync',
  '/api/v1/wallet/sync/mailbox',
  '/api/v1/wallet/vtxos',
  '/api/v1/wallet/vtxos/{param}',
  '/api/v1/wallet/vtxos/{param}/encoded',
  // Bull's expired-coin routes, called outside the generated client.
  '/api/v1/wallet/vtxos/adopt-server-status',
  '/api/v1/wallet/vtxos/expiry-payouts',
  '/api/v1/onchain/sweep-expiry-payouts'
] as const

const PARAM_PLACEHOLDER = '{param}'
// One path segment: non-empty, no slash. A param can never span segments, so it
// can never expand a route into a different one (e.g. reach `/wallet/mnemonic`).
const PARAM_PATTERN = '[^/]+'

function routeToRegExp(route: string): RegExp {
  const source = route
    .split('/')
    .map((segment) =>
      segment === PARAM_PLACEHOLDER
        ? PARAM_PATTERN
        : segment.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&')
    )
    .join('/')
  return new RegExp(`^${source}$`, 'u')
}

const ALLOWED_EXACT = new Set<string>(
  ALLOWED_BARKD_ROUTES.filter((route) => !route.includes(PARAM_PLACEHOLDER))
)
const ALLOWED_PATTERNS = ALLOWED_BARKD_ROUTES.filter((route) =>
  route.includes(PARAM_PLACEHOLDER)
).map(routeToRegExp)

// Collapse repeated slashes and drop a trailing slash so barkd's slash-tolerant
// routing can't be used to dodge the allowlist. Runs on the already-canonical
// `pathname` (control bytes stripped, `..` resolved by the URL parser), so no
// further decoding is needed.
function canonicalizeBarkdPath(pathname: string): string {
  const collapsed = pathname.replaceAll(/\/{2,}/gu, '/')
  return collapsed.length > 1 ? collapsed.replace(/\/+$/u, '') : collapsed
}

// The pathname passed here must be the one that will actually be sent upstream
// (i.e. `new URL(...).pathname`), not the raw inbound request path.
export function isAllowedBarkdPath(pathname: string): boolean {
  const path = canonicalizeBarkdPath(pathname)
  if (ALLOWED_EXACT.has(path)) {
    return true
  }
  return ALLOWED_PATTERNS.some((pattern) => pattern.test(path))
}
