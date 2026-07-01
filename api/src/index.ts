import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import type { Context, Next } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { cors } from 'hono/cors'
import { Authenticator } from './auth.js'

const WALLET_DIR = process.env.WALLET_DIR ?? '/wallet-data/.bark'
const PORT = Number.parseInt(process.env.PORT ?? '4001', 10)
const HOSTNAME =
  process.env.HOST !== undefined && process.env.HOST !== '' ? process.env.HOST : '0.0.0.0'
const BARKD_URL = process.env.BARKD_URL ?? 'http://barkd:4000'
const ARK_SERVER = process.env.ARK_SERVER ?? ''
const CHAIN_SOURCE = process.env.CHAIN_SOURCE ?? ''
const BARK_NETWORK = process.env.BARK_NETWORK ?? 'signet'
const WALLET_DATA_PATH = process.env.WALLET_DATA_PATH ?? '/data/.bark/'
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
)

const TOKEN_PATH = `${WALLET_DIR}/auth_token`
const LOG_PATH = `${WALLET_DIR}/debug.log`
const LOG_DOWNLOAD_NAME = 'barkd-debug.log'

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
    chainSource: CHAIN_SOURCE,
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

app.all('/api/barkd/*', async (c) => {
  const subPath = c.req.path.replace(BARKD_PATH_PREFIX, '')
  const incoming = new URL(c.req.url)
  const upstreamUrl = `${BARKD_URL}${subPath}${incoming.search}`

  const headers = new Headers()
  for (const [key, value] of Object.entries(c.req.header())) {
    const lower = key.toLowerCase()
    if (HOP_BY_HOP_HEADERS.has(lower) || lower === 'authorization') {
      continue
    }
    headers.set(key, value)
  }
  const token = await getToken()
  if (token !== null) {
    headers.set('authorization', `Bearer ${token}`)
  }

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
  console.log(`bark-web-api listening on :${info.port}`)
})
