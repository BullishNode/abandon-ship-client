import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

const WALLET_DIR = process.env.WALLET_DIR ?? '/wallet-data/.bark'
const PORT = Number.parseInt(process.env.PORT ?? '4001', 10)
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
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
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

serve({ fetch: app.fetch, hostname: '0.0.0.0', port: PORT }, (info) => {
  console.log(`bark-web-api listening on :${info.port}`)
})
