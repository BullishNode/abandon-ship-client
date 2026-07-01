import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { readFile, rename, writeFile } from 'node:fs/promises'

const SESSION_COOKIE_NAME = 'bark_session'
const SECRET_BYTES = 32

const LOCKOUT_THRESHOLD = 5
const LOCKOUT_BASE_MS = 1000
const LOCKOUT_MAX_MS = 15 * 60 * 1000
const MAX_TRACKED_CLIENTS = 1024

interface AttemptState {
  failures: number
  lockedUntil: number
}

interface AuthOptions {
  passwordFile: string
  secretPath: string
  ttlSeconds: number
}

function base64url(buffer: Buffer): string {
  return buffer.toString('base64url')
}

function sha256(value: string): Buffer {
  return createHmac('sha256', 'bark-ui-const-time').update(value).digest()
}

function constantTimeEquals(a: string, b: string): boolean {
  return timingSafeEqual(sha256(a), sha256(b))
}

export class Authenticator {
  private readonly passwordFile: string
  private readonly secretPath: string
  private readonly ttlSeconds: number
  private secretPromise: Promise<string> | null = null
  private readonly attempts = new Map<string, AttemptState>()

  constructor(options: AuthOptions) {
    this.passwordFile = options.passwordFile
    this.secretPath = options.secretPath
    this.ttlSeconds = options.ttlSeconds
  }

  private async readPassword(): Promise<string | null> {
    try {
      const raw = await readFile(this.passwordFile, 'utf-8')
      const value = raw.trim()
      return value.length > 0 ? value : null
    } catch {
      return null
    }
  }

  async isConfigured(): Promise<boolean> {
    return (await this.readPassword()) !== null
  }

  private async loadSecret(): Promise<string> {
    this.secretPromise ??= this.resolveSecretGuarded()
    return await this.secretPromise
  }

  private async resolveSecretGuarded(): Promise<string> {
    try {
      return await this.resolveSecret()
    } catch (error) {
      // Allow a later request to retry if persisting the secret failed.
      this.secretPromise = null
      throw error
    }
  }

  private async resolveSecret(): Promise<string> {
    try {
      const raw = await readFile(this.secretPath, 'utf-8')
      const existing = raw.trim()
      if (existing.length > 0) {
        return existing
      }
    } catch {
      // fall through to generate
    }

    const generated = randomBytes(SECRET_BYTES).toString('hex')
    const tmp = `${this.secretPath}.${randomBytes(6).toString('hex')}.tmp`

    await writeFile(tmp, generated, { mode: 0o600 })
    await rename(tmp, this.secretPath)

    return generated
  }

  private async signingKey(password: string): Promise<Buffer> {
    const secret = await this.loadSecret()
    return createHmac('sha256', secret).update(password).digest()
  }

  private async sign(payload: string, password: string): Promise<string> {
    const key = await this.signingKey(password)
    return base64url(createHmac('sha256', key).update(payload).digest())
  }

  async verifyPassword(input: string): Promise<boolean> {
    const password = await this.readPassword()
    if (password === null) {
      return false
    }
    return constantTimeEquals(input, password)
  }

  async issueCookie(): Promise<string> {
    const password = await this.readPassword()
    if (password === null) {
      throw new Error('Cannot issue session: UI password not configured')
    }
    const expiry = Date.now() + this.ttlSeconds * 1000
    const payload = String(expiry)
    const signature = await this.sign(payload, password)
    return `${payload}.${signature}`
  }

  async verifyCookie(value: string | undefined): Promise<boolean> {
    if (value === undefined) {
      return false
    }

    const separator = value.indexOf('.')
    if (separator <= 0) {
      return false
    }

    const payload = value.slice(0, separator)
    const signature = value.slice(separator + 1)
    const expiry = Number.parseInt(payload, 10)

    if (!Number.isFinite(expiry) || expiry <= Date.now()) {
      return false
    }

    const password = await this.readPassword()
    if (password === null) {
      return false
    }

    const expected = await this.sign(payload, password)
    if (expected.length !== signature.length) {
      return false
    }

    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  }

  readonly cookieName = SESSION_COOKIE_NAME

  get ttl(): number {
    return this.ttlSeconds
  }

  isLockedOut(clientKey: string): boolean {
    const state = this.attempts.get(clientKey)
    return state !== undefined && Date.now() < state.lockedUntil
  }

  registerSuccess(clientKey: string): void {
    this.attempts.delete(clientKey)
  }

  registerFailure(clientKey: string): void {
    const now = Date.now()
    this.pruneAttempts(now)
    const state = this.attempts.get(clientKey) ?? { failures: 0, lockedUntil: 0 }
    state.failures += 1
    if (state.failures >= LOCKOUT_THRESHOLD) {
      const overage = state.failures - LOCKOUT_THRESHOLD
      state.lockedUntil = now + Math.min(LOCKOUT_BASE_MS * 2 ** overage, LOCKOUT_MAX_MS)
    }
    this.attempts.set(clientKey, state)
  }

  private pruneAttempts(now: number): void {
    if (this.attempts.size < MAX_TRACKED_CLIENTS) {
      return
    }
    // Drop entries whose lockout has elapsed; they carry no live penalty.
    for (const [key, state] of this.attempts) {
      if (state.lockedUntil <= now) {
        this.attempts.delete(key)
      }
    }
    // Still full of active locks: evict oldest (insertion-ordered) to stay bounded.
    if (this.attempts.size >= MAX_TRACKED_CLIENTS) {
      for (const key of this.attempts.keys()) {
        this.attempts.delete(key)
        if (this.attempts.size < MAX_TRACKED_CLIENTS) {
          break
        }
      }
    }
  }
}
