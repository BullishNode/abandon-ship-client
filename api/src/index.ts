import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { timingSafeEqual } from 'node:crypto'
import { serve } from '@hono/node-server'
import archiver from 'archiver'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

const WALLET_DIR = process.env.WALLET_DIR ?? '/wallet-data/.bark'
const PORT = Number.parseInt(process.env.PORT ?? '4001', 10)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())

const TOKEN_PATH = `${WALLET_DIR}/auth_token`
const MNEMONIC_PATH = `${WALLET_DIR}/mnemonic`
const DB_PATH = `${WALLET_DIR}/db.sqlite`

async function readAuthToken(): Promise<string> {
  const token = await readFile(TOKEN_PATH, 'utf8')
  return token.trim()
}

function compareTokens(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided)
  const expectedBuf = Buffer.from(expected)
  if (providedBuf.length !== expectedBuf.length) {
    return false
  }
  return timingSafeEqual(providedBuf, expectedBuf)
}

const app = new Hono()

app.use(
  '*',
  cors({
    origin: ALLOWED_ORIGINS,
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'OPTIONS']
  })
)

app.use('/api/*', async (c, next) => {
  const header = c.req.header('Authorization') ?? ''
  const provided = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (provided.length === 0) {
    return c.json({ error: 'Missing bearer token' }, 401)
  }
  let expected: string
  try {
    expected = await readAuthToken()
  } catch {
    return c.json({ error: 'Auth token unavailable' }, 503)
  }
  if (!compareTokens(provided, expected)) {
    return c.json({ error: 'Invalid token' }, 401)
  }
  await next()
})

app.get('/health', (c) => c.json({ ok: true }))

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
  archive.finalize().catch((error) => {
    console.error('Archive finalize failed', error)
  })

  const webStream = Readable.toWeb(archive) as unknown as ReadableStream<Uint8Array>
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

  return new Response(webStream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="bark-wallet-backup-${timestamp}.zip"`
    }
  })
})

serve({ fetch: app.fetch, port: PORT, hostname: '0.0.0.0' }, (info) => {
  console.log(`bark-web-api listening on :${info.port}`)
})
