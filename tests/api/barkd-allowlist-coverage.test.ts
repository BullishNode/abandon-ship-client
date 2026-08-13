// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isAllowedBarkdPath } from '../../api/src/barkd-proxy.ts'

// Derive the app's real barkd surface from the installed `@secondts/barkd` client
// and assert the allowlist covers all of it (minus the mnemonic route). If the SDK
// gains a route, this fails until the allowlist in `barkd-proxy.ts` is updated —
// so a new endpoint can never silently 404, and the allowlist can never drift.

const MNEMONIC_ROUTE = '/api/v1/wallet/mnemonic'
const URL_PATH_LITERAL = /let urlPath = `([^`]+)`/gu

function sdkApiDir(): string {
  const require = createRequire(import.meta.url)
  const pkgJson = require.resolve('@secondts/barkd/package.json')
  return join(dirname(pkgJson), 'dist', 'apis')
}

function extractSdkRoutes(): string[] {
  const dir = sdkApiDir()
  const routes = new Set<string>()
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.js')) {
      continue
    }
    const source = readFileSync(join(dir, file), 'utf-8')
    for (const match of source.matchAll(URL_PATH_LITERAL)) {
      routes.add(match[1])
    }
  }
  return [...routes]
}

// A concrete request path for a route, substituting a sample value for each
// `{param}` placeholder the SDK uses.
function toRequestPath(route: string): string {
  return route.replaceAll(/\{[^}]+\}/gu, 'sample-value')
}

describe('allowlist coverage vs @secondts/barkd', () => {
  const sdkRoutes = extractSdkRoutes()

  it('extracts a non-trivial route set from the SDK', () => {
    // Guards against the extraction silently returning nothing (e.g. SDK codegen
    // format changed), which would make the coverage assertion vacuously pass.
    expect(sdkRoutes.length).toBeGreaterThan(50)
    expect(sdkRoutes).toContain(MNEMONIC_ROUTE)
  })

  it('allows every SDK route except mnemonic', () => {
    const shouldAllow = sdkRoutes.filter((route) => route !== MNEMONIC_ROUTE)
    const wronglyRejected = shouldAllow.filter((route) => !isAllowedBarkdPath(toRequestPath(route)))
    expect(wronglyRejected).toStrictEqual([])
  })

  it('rejects the mnemonic route', () => {
    expect(isAllowedBarkdPath(MNEMONIC_ROUTE)).toBeFalsy()
  })
})
