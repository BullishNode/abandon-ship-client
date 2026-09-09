// @vitest-environment node
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Authenticator, isAcceptablePassword, MIN_PASSWORD_LENGTH } from '../../api/src/auth.ts'

const VERIFIER_RECORD_PATTERN = /^v1\$[0-9a-f]{32}\$[0-9a-f]{64}$/u

// Windows/NTFS has no POSIX permission triplet: node reports 0666 even after an
// explicit chmod(0o600), so the mode bits are only assertable on the POSIX hosts
// the images actually run on.
const itPosix = it.skipIf(false)

const dirs: string[] = []

async function authenticator() {
  const dir = await mkdtemp(join(tmpdir(), 'bark-authenticator-'))
  dirs.push(dir)
  const passwordFile = join(dir, 'ui_password')
  const auth = new Authenticator({
    passwordFile,
    secretPath: join(dir, 'ui_session_secret'),
    ttlSeconds: 60
  })
  return { auth, dir, passwordFile }
}

describe(isAcceptablePassword, () => {
  it.each([
    ['longenough', true],
    ['x'.repeat(MIN_PASSWORD_LENGTH), true],
    ['x'.repeat(MIN_PASSWORD_LENGTH - 1), false],
    ['', false],
    // The stored record is trimmed on read, so a padded password could never be typed back in.
    [' longenough', false],
    ['longenough ', false]
  ])('rates %j as %s', (password, expected) => {
    expect(isAcceptablePassword(password)).toBe(expected)
  })
})

describe('Authenticator.setupPassword', () => {
  afterEach(async () => {
    for (const dir of dirs.splice(0)) {
      await rm(dir, { force: true, recursive: true })
    }
  })

  it('writes a hashed verifier file with no leftover temp file', async () => {
    const { auth, dir, passwordFile } = await authenticator()

    await expect(auth.setupPassword('longenough')).resolves.toBeTruthy()

    const record = await readFile(passwordFile, 'utf-8')
    expect(record).toMatch(VERIFIER_RECORD_PATTERN)
    expect(record).not.toContain('longenough')
    await expect(readdir(dir)).resolves.toStrictEqual(['ui_password'])
  })

  itPosix('writes the verifier file with mode 0600', async () => {
    const { auth, passwordFile } = await authenticator()

    await expect(auth.setupPassword('longenough')).resolves.toBeTruthy()

    const stats = await stat(passwordFile)
    // `% 0o1000` keeps the permission bits without a bitwise mask.
    expect(stats.mode % 0o1000).toBe(0o600)
  })

  it('makes the authenticator configured and the password verifiable', async () => {
    const { auth } = await authenticator()
    await expect(auth.isConfigured()).resolves.toBeFalsy()

    await auth.setupPassword('longenough')

    await expect(auth.isConfigured()).resolves.toBeTruthy()
    await expect(auth.verifyPassword('longenough')).resolves.toBeTruthy()
    await expect(auth.verifyPassword('longenoug')).resolves.toBeFalsy()
  })

  it('rejects a password below the minimum without touching the file', async () => {
    const { auth, passwordFile } = await authenticator()
    await writeFile(passwordFile, 'existingpassword')

    await expect(auth.setupPassword('short')).rejects.toThrow(
      'Password does not meet the minimum requirements'
    )

    await expect(readFile(passwordFile, 'utf-8')).resolves.toBe('existingpassword')
  })

  it('returns false and keeps the existing password when one is already set', async () => {
    const { auth, dir, passwordFile } = await authenticator()
    await writeFile(passwordFile, 'existingpassword')

    await expect(auth.setupPassword('longenough')).resolves.toBeFalsy()

    await expect(readFile(passwordFile, 'utf-8')).resolves.toBe('existingpassword')
    await expect(readdir(dir)).resolves.toStrictEqual(['ui_password'])
  })

  it('lets exactly one of several concurrent setups win', async () => {
    const { auth, dir, passwordFile } = await authenticator()
    const passwords = Array.from({ length: 8 }, (_, i) => `password-${i}`)

    const results = await Promise.all(passwords.map(async (p) => await auth.setupPassword(p)))

    const winners = results.filter(Boolean)
    expect(winners).toHaveLength(1)
    const winnerPassword = passwords[results.indexOf(true)]
    await expect(auth.verifyPassword(winnerPassword)).resolves.toBeTruthy()
    for (const loser of passwords.filter((p) => p !== winnerPassword)) {
      await expect(auth.verifyPassword(loser)).resolves.toBeFalsy()
    }
    const record = await readFile(passwordFile, 'utf-8')
    expect(record).toMatch(VERIFIER_RECORD_PATTERN)
    expect(record).not.toContain(winnerPassword)
    await expect(readdir(dir)).resolves.toStrictEqual(['ui_password'])
  })
})
