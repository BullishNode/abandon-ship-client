// @vitest-environment node
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Hono } from 'hono'
import { afterEach, describe, expect, it, vi } from 'vitest'

// `api/src/index.ts` reads its env once, at module scope, so every case gets a
// fresh module instance pointed at its own wallet dir. Importing the app has no
// side effects (no port bind), so re-evaluating it is cheap.
async function loadApp(dir: string, uiAuth: boolean): Promise<Hono> {
  vi.resetModules()
  vi.stubEnv('WALLET_DIR', dir)
  vi.stubEnv('UI_AUTH', uiAuth ? 'true' : 'false')
  const { app } = await import('../../api/src/index.ts')
  return app
}

const walletDirs: string[] = []

async function walletDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'bark-auth-setup-'))
  walletDirs.push(dir)
  return dir
}

const CSRF_HEADERS = { 'x-requested-with': 'bark' }

const VERIFIER_RECORD_PATTERN = /^v1\$[0-9a-f]{32}\$[0-9a-f]{64}$/u

async function setup(app: Hono, body: unknown, headers?: Record<string, string>) {
  return await app.request('http://localhost:4001/api/auth/setup', {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...(headers ?? CSRF_HEADERS) },
    method: 'POST'
  })
}

async function login(app: Hono, password: string) {
  return await app.request('http://localhost:4001/api/login', {
    body: JSON.stringify({ password }),
    headers: { 'content-type': 'application/json', ...CSRF_HEADERS },
    method: 'POST'
  })
}

describe('POST /api/auth/setup', () => {
  afterEach(async () => {
    vi.unstubAllEnvs()
    vi.resetModules()
    for (const dir of walletDirs.splice(0)) {
      await rm(dir, { force: true, recursive: true })
    }
  })

  it('404s when UI_AUTH is off', async () => {
    const dir = await walletDir()
    const app = await loadApp(dir, false)

    const res = await setup(app, { password: 'longenough' })

    expect(res.status).toBe(404)
    await expect(stat(join(dir, 'ui_password'))).rejects.toThrow('ENOENT')
  })

  it('403s without the CSRF header', async () => {
    const dir = await walletDir()
    const app = await loadApp(dir, true)

    const res = await setup(app, { password: 'longenough' }, {})

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toStrictEqual({ error: 'csrf' })
    await expect(stat(join(dir, 'ui_password'))).rejects.toThrow('ENOENT')
  })

  it.each([['short'], ['  padded password  '], ['']])(
    'rejects %j as too weak without writing anything',
    async (password) => {
      const dir = await walletDir()
      const app = await loadApp(dir, true)

      const res = await setup(app, { password })

      expect(res.status).toBe(400)
      await expect(res.json()).resolves.toStrictEqual({ error: 'weak_password', minLength: 8 })
      await expect(stat(join(dir, 'ui_password'))).rejects.toThrow('ENOENT')
    }
  )

  it('rejects a non-string password', async () => {
    const dir = await walletDir()
    const app = await loadApp(dir, true)

    const res = await setup(app, { password: 12_345_678 })

    expect(res.status).toBe(400)
  })

  it('writes a hashed verifier file 0600 and issues a session cookie', async () => {
    const dir = await walletDir()
    const app = await loadApp(dir, true)

    const res = await setup(app, { password: 'longenough' })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toStrictEqual({ ok: true })
    expect(res.headers.get('set-cookie')).toMatch(/^bark_session=/u)
    const passwordFile = join(dir, 'ui_password')
    const record = await readFile(passwordFile, 'utf-8')
    expect(record).toMatch(VERIFIER_RECORD_PATTERN)
    expect(record).not.toContain('longenough')
    const stats = await stat(passwordFile)
    // `% 0o1000` keeps the permission bits without a bitwise mask.
    expect(stats.mode % 0o1000).toBe(0o600)
  })

  it('409s on a second call and leaves the first password in place', async () => {
    const dir = await walletDir()
    const app = await loadApp(dir, true)

    await setup(app, { password: 'longenough' })
    const recordAfterFirst = await readFile(join(dir, 'ui_password'), 'utf-8')
    const res = await setup(app, { password: 'someoneelse' })

    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toStrictEqual({ error: 'auth_already_configured' })
    await expect(readFile(join(dir, 'ui_password'), 'utf-8')).resolves.toBe(recordAfterFirst)
    const loginRes = await login(app, 'longenough')
    expect(loginRes.status).toBe(200)
  })

  it('lets exactly one of several concurrent setups succeed', async () => {
    const dir = await walletDir()
    const app = await loadApp(dir, true)
    const passwords = Array.from({ length: 8 }, (_, i) => `password-${i}`)

    const responses = await Promise.all(
      passwords.map(async (p) => await setup(app, { password: p }))
    )

    const winners = responses.filter((res) => res.status === 200)
    const losers = responses.filter((res) => res.status === 409)
    expect(winners).toHaveLength(1)
    expect(losers).toHaveLength(passwords.length - 1)
    expect(winners[0]?.headers.get('set-cookie')).toMatch(/^bark_session=/u)
    expect(losers.map((res) => res.headers.get('set-cookie'))).toStrictEqual(losers.map(() => null))
    for (const loser of losers) {
      await expect(loser.json()).resolves.toStrictEqual({ error: 'auth_already_configured' })
    }
    const winnerPassword = passwords[responses.findIndex((res) => res.status === 200)]
    const record = await readFile(join(dir, 'ui_password'), 'utf-8')
    expect(record).toMatch(VERIFIER_RECORD_PATTERN)
    expect(record).not.toContain(winnerPassword)
    const loginRes = await login(app, winnerPassword)
    expect(loginRes.status).toBe(200)
  })

  it('flips GET /api/auth/status to configured once the password is set', async () => {
    const dir = await walletDir()
    const app = await loadApp(dir, true)

    const before = await app.request('http://localhost:4001/api/auth/status')
    await expect(before.json()).resolves.toStrictEqual({
      authRequired: true,
      authed: false,
      configured: false
    })

    await setup(app, { password: 'longenough' })

    const after = await app.request('http://localhost:4001/api/auth/status')
    await expect(after.json()).resolves.toStrictEqual({
      authRequired: true,
      authed: false,
      configured: true
    })
  })
})
