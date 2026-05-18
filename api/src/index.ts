import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { serve } from '@hono/node-server'
import archiver from 'archiver'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

const WALLET_DIR = process.env.WALLET_DIR ?? '/wallet-data/.bark'
const PORT = Number.parseInt(process.env.PORT ?? '4001', 10)
const BARKD_URL = process.env.BARKD_URL ?? 'http://barkd:4000'
const ARK_SERVER = process.env.ARK_SERVER ?? ''
const CHAIN_SOURCE = process.env.CHAIN_SOURCE ?? ''
const BARK_NETWORK = process.env.BARK_NETWORK ?? 'signet'

const TOKEN_PATH = `${WALLET_DIR}/auth_token`
const MNEMONIC_PATH = `${WALLET_DIR}/mnemonic`
const DB_PATH = `${WALLET_DIR}/db.sqlite`

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
    origin: (origin) => origin ?? '*'
  })
)

app.get('/health', (c) => c.json({ ok: true }))

app.get('/api/config', (c) =>
  c.json({
    arkServer: ARK_SERVER,
    chainSource: CHAIN_SOURCE,
    network: BARK_NETWORK
  })
)

app.get('/api/backup', async (c) => {
  try {
    await stat(MNEMONIC_PATH)
    await stat(DB_PATH)
  } catch {
    return c.json({ error: 'Wallet files not found' }, 404)
  }

  const archive = archiver('zip', { zlib: { level: 9 } })
  archive.file(MNEMONIC_PATH, { name: 'mnemonic' })
  archive.append(createReadStream(DB_PATH), { name: 'db.sqlite' })
  void (async () => {
    try {
      await archive.finalize()
    } catch (error: unknown) {
      console.error('Archive finalize failed', error)
    }
  })()

  const webStream = Readable.toWeb(archive) as ReadableStream
  const timestamp = new Date().toISOString().replaceAll(/[:.]/gu, '-')

  return new Response(webStream, {
    headers: {
      'Content-Disposition': `attachment; filename="bark-wallet-backup-${timestamp}.zip"`,
      'Content-Type': 'application/zip'
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
