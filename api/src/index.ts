import { randomBytes } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { Readable } from 'node:stream'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import type { Context, Next } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { cors } from 'hono/cors'
import { Authenticator } from './auth.js'
import { isBlockedBarkdSubPath } from './barkd-proxy.js'
import { buildChainSource } from './chain-source.js'

const WALLET_DIR = process.env.WALLET_DIR ?? '/wallet-data/.bark'
const PORT = Number.parseInt(process.env.PORT ?? '4001', 10)
const HOSTNAME =
  process.env.HOST !== undefined && process.env.HOST !== '' ? process.env.HOST : '0.0.0.0'
const BARKD_URL = process.env.BARKD_URL ?? 'http://barkd:4000'
const BARKD_REQUEST_TIMEOUT_MS = 10_000
const ARK_SERVER = process.env.ARK_SERVER ?? ''
const BARK_NETWORK = process.env.BARK_NETWORK ?? 'signet'
const WALLET_DATA_PATH = process.env.WALLET_DATA_PATH ?? '/data/.bark/'
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
)

// A misconfigured chain source warns instead of throwing: this process also
// serves `/api/barkd/*` for every existing wallet, and a startup throw would
// crash-loop the whole deployment.
const { chainSource: CHAIN_SOURCE_CONFIG, warnings: CHAIN_SOURCE_WARNINGS } = buildChainSource({
  bitcoindRpcCookieFile: process.env.BITCOIND_RPC_COOKIE_FILE,
  bitcoindRpcUrl: process.env.BITCOIND_RPC_URL,
  chainSource: process.env.CHAIN_SOURCE
})

const TOKEN_PATH = `${WALLET_DIR}/auth_token`
const LOG_PATH = `${WALLET_DIR}/debug.log`
const LOG_DOWNLOAD_NAME = 'barkd-debug.log'
const DB_PATH = `${WALLET_DIR}/db.sqlite`

const UI_AUTH = (process.env.UI_AUTH ?? 'false').toLowerCase() === 'true'
const UI_PASSWORD_FILE = process.env.UI_PASSWORD_FILE ?? `${WALLET_DIR}/ui_password`
const SESSION_SECRET_PATH = process.env.UI_SESSION_SECRET_FILE ?? `${WALLET_DIR}/ui_session_secret`
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60
const CSRF_HEADER = 'x-requested-with'
const CSRF_TOKEN = 'bark'
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

const auth = new Authenticator({
  passwordFile: UI_PASSWORD_FILE,
  secretPath: SESSION_SECRET_PATH,
  ttlSeconds: SESSION_TTL_SECONDS
})

let cachedToken: string | null = null

async function getToken(): Promise<string | null> {
  if (cachedToken !== null) {
    return cachedToken
  }
  try {
    const raw = await readFile(TOKEN_PATH, 'utf-8')
    const value = raw.trim()
    if (value.length > 0) {
      cachedToken = value
    }
    return cachedToken
  } catch {
    return null
  }
}

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade'
])

const BARKD_PATH_PREFIX = /^\/api\/barkd/u

// Any inbound `authorization` header is dropped so callers can never override
// the proxy's own injected credential.
async function barkdHeaders(inbound?: Record<string, string>): Promise<Headers> {
  const headers = new Headers()
  if (inbound !== undefined) {
    for (const [key, value] of Object.entries(inbound)) {
      const lower = key.toLowerCase()
      if (HOP_BY_HOP_HEADERS.has(lower) || lower === 'authorization') {
        continue
      }
      headers.set(key, value)
    }
  }
  const token = await getToken()
  if (token !== null) {
    headers.set('authorization', `Bearer ${token}`)
  }
  return headers
}

const app = new Hono()

app.use(
  '*',
  cors({
    allowHeaders: ['Authorization', 'Content-Type', 'X-Requested-With'],
    allowMethods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    origin: (origin) => {
      if (origin === undefined) {
        return origin
      }
      return ALLOWED_ORIGINS.has(origin) ? origin : null
    }
  })
)

app.get('/health', (c) => c.json({ ok: true }))

app.get('/api/config', (c) =>
  c.json({
    arkServer: ARK_SERVER,
    ...(CHAIN_SOURCE_CONFIG === undefined ? {} : { chainSource: CHAIN_SOURCE_CONFIG }),
    network: BARK_NETWORK,
    walletDataPath: WALLET_DATA_PATH
  })
)

function isSecureRequest(c: { req: { header: (name: string) => string | undefined } }): boolean {
  return c.req.header('x-forwarded-proto') === 'https'
}

function clientKey(c: Context): string {
  const forwardedFor = c.req.header('x-forwarded-for')
  if (forwardedFor !== undefined && forwardedFor !== '') {
    const lastHop = forwardedFor.split(',').at(-1)?.trim()
    if (lastHop !== undefined && lastHop !== '') {
      return lastHop
    }
  }
  return 'global'
}

interface LoginBody {
  password?: unknown
}

app.get('/api/auth/status', async (c) => {
  if (!UI_AUTH) {
    return c.json({ authRequired: false, authed: true })
  }
  const authed = await auth.verifyCookie(getCookie(c, auth.cookieName))
  return c.json({ authRequired: true, authed })
})

app.post('/api/login', async (c) => {
  if (!UI_AUTH) {
    return c.json({ ok: true })
  }
  const key = clientKey(c)
  if (auth.isLockedOut(key)) {
    return c.json({ error: 'rate_limited' }, 429)
  }
  if (!(await auth.isConfigured())) {
    return c.json({ error: 'auth_unconfigured' }, 503)
  }
  const body = await c.req.json<LoginBody>().catch(() => null)
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!(await auth.verifyPassword(password))) {
    auth.registerFailure(key)
    return c.json({ error: 'invalid_credentials' }, 401)
  }
  auth.registerSuccess(key)
  setCookie(c, auth.cookieName, await auth.issueCookie(), {
    httpOnly: true,
    maxAge: auth.ttl,
    path: '/',
    sameSite: 'Strict',
    secure: isSecureRequest(c)
  })
  return c.json({ ok: true })
})

app.post('/api/logout', (c) => {
  deleteCookie(c, auth.cookieName, { path: '/' })
  return c.json({ ok: true })
})

async function requireSession(c: Context, next: Next) {
  if (!UI_AUTH) {
    await next()
    return
  }
  let denial: Response | null = null
  if (!(await auth.isConfigured())) {
    denial = c.json({ error: 'auth_unconfigured' }, 503)
  } else if (!(await auth.verifyCookie(getCookie(c, auth.cookieName)))) {
    denial = c.json({ error: 'unauthorized' }, 401)
  } else if (STATE_CHANGING_METHODS.has(c.req.method) && c.req.header(CSRF_HEADER) !== CSRF_TOKEN) {
    denial = c.json({ error: 'csrf' }, 403)
  }
  if (denial) {
    c.res = denial
    return
  }
  await next()
}

app.use('/api/barkd/*', async (c: Context, next: Next) => {
  await requireSession(c, next)
})

app.use('/api/logs', async (c: Context, next: Next) => {
  await requireSession(c, next)
})

app.use('/api/export-db', async (c: Context, next: Next) => {
  await requireSession(c, next)
})

app.use('/api/reveal-mnemonic', async (c: Context, next: Next) => {
  await requireSession(c, next)
})

async function getLogSize(): Promise<number | null> {
  try {
    const stats = await stat(LOG_PATH)
    return stats.size
  } catch {
    return null
  }
}

app.get('/api/logs', async (c) => {
  const size = await getLogSize()
  if (size === null) {
    return c.json({ error: 'log_unavailable' }, 404)
  }
  const stream = Readable.toWeb(
    createReadStream(LOG_PATH, size > 0 ? { end: size - 1 } : undefined)
  )
  return new Response(stream, {
    headers: {
      'Content-Disposition': `attachment; filename="${LOG_DOWNLOAD_NAME}"`,
      'Content-Length': String(size),
      'Content-Type': 'text/plain; charset=utf-8'
    }
  })
})

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

// Consistent snapshot of the live wallet database. barkd keeps the SQLite file
// open (WAL mode), so a raw file copy could ship a torn page set; VACUUM INTO
// runs inside a read transaction and writes a compacted, self-contained copy.
// The source is opened read-only so the export can never mutate wallet state.
function snapshotDatabase(sourcePath: string, targetPath: string): void {
  const db = new DatabaseSync(sourcePath, { readOnly: true })
  try {
    db.exec(`VACUUM INTO '${targetPath.replaceAll("'", "''")}'`)
  } finally {
    db.close()
  }
}

app.get('/api/export-db', async (c) => {
  if (!(await fileExists(DB_PATH))) {
    return c.json({ error: 'db_unavailable' }, 404)
  }
  const snapshotPath = join(tmpdir(), `bark-db-export-${randomBytes(8).toString('hex')}.sqlite`)
  try {
    snapshotDatabase(DB_PATH, snapshotPath)
    const snapshot = await readFile(snapshotPath)
    const timestamp = new Date().toISOString().replaceAll(':', '-').slice(0, 19)
    return new Response(new Uint8Array(snapshot), {
      headers: {
        'Content-Disposition': `attachment; filename="bark-wallet-${BARK_NETWORK}-${timestamp}.sqlite"`,
        'Content-Length': String(snapshot.byteLength),
        'Content-Type': 'application/octet-stream'
      }
    })
  } catch {
    return c.json({ error: 'export_failed' }, 500)
  } finally {
    await rm(snapshotPath, { force: true })
  }
})

function extractMnemonic(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null || !('mnemonic' in payload)) {
    return null
  }
  const { mnemonic } = payload
  return typeof mnemonic === 'string' ? mnemonic : null
}

// POST (not GET) keeps this off the drive-by URL surface and, under UI_AUTH,
// subjects it to the CSRF check in `requireSession`.
app.post('/api/reveal-mnemonic', async (c) => {
  const headers = await barkdHeaders()
  let upstream: Response
  try {
    upstream = await fetch(`${BARKD_URL}/api/v1/wallet/mnemonic`, {
      headers,
      method: 'GET',
      signal: AbortSignal.timeout(BARKD_REQUEST_TIMEOUT_MS)
    })
  } catch {
    return c.json({ error: 'mnemonic_unavailable' }, 502)
  }
  if (!upstream.ok) {
    return c.json({ error: 'mnemonic_unavailable' }, 502)
  }
  const payload = await upstream.json().catch(() => null)
  const mnemonic = extractMnemonic(payload)
  if (mnemonic === null) {
    return c.json({ error: 'mnemonic_unavailable' }, 502)
  }
  return c.json({ mnemonic })
})

app.all('/api/barkd/*', async (c) => {
  const subPath = c.req.path.replace(BARKD_PATH_PREFIX, '')
  // 404 (not 403) mirrors barkd's own response when mnemonic exposure is off.
  if (isBlockedBarkdSubPath(subPath)) {
    return c.json({ error: 'not_found' }, 404)
  }
  const incoming = new URL(c.req.url)
  const upstreamUrl = `${BARKD_URL}${subPath}${incoming.search}`

  const headers = await barkdHeaders(c.req.header())

  const { method } = c.req
  const hasBody = !(method === 'GET' || method === 'HEAD')
  const init: RequestInit & { duplex?: 'half' } = {
    headers,
    method
  }
  if (hasBody) {
    init.body = c.req.raw.body
    init.duplex = 'half'
  }

  const upstream = await fetch(upstreamUrl, init)

  const responseHeaders = new Headers()
  for (const [key, value] of upstream.headers.entries()) {
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      continue
    }
    responseHeaders.set(key, value)
  }

  return new Response(upstream.body, {
    headers: responseHeaders,
    status: upstream.status,
    statusText: upstream.statusText
  })
})

serve({ fetch: app.fetch, hostname: HOSTNAME, port: PORT }, (info) => {
  for (const warning of CHAIN_SOURCE_WARNINGS) {
    console.warn(warning)
  }
  console.log(`bark-web-api listening on :${info.port}`)
})
