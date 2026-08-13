import { describe, expect, it } from 'vitest'
import { isAllowedBarkdPath } from '../../api/src/barkd-proxy.ts'

// `isAllowedBarkdPath` receives the canonical upstream pathname (what
// `new URL(...).pathname` produces), so the raw-encoding cases below mirror what
// the URL parser leaves after stripping control bytes and resolving `..`.
describe(isAllowedBarkdPath, () => {
  it('allows plain routes the client calls', () => {
    expect(isAllowedBarkdPath('/api/v1/wallet/balance')).toBeTruthy()
    expect(isAllowedBarkdPath('/api/v1/wallet/send')).toBeTruthy()
    expect(isAllowedBarkdPath('/api/v1/onchain/utxos')).toBeTruthy()
    expect(isAllowedBarkdPath('/ping')).toBeTruthy()
  })

  it('allows parameterized routes with any single-segment value', () => {
    expect(isAllowedBarkdPath('/api/v1/wallet/vtxos/abc123')).toBeTruthy()
    expect(isAllowedBarkdPath('/api/v1/wallet/vtxos/abc123/encoded')).toBeTruthy()
    expect(isAllowedBarkdPath('/api/v1/exits/cancel/deadbeef')).toBeTruthy()
    expect(isAllowedBarkdPath('/api/v1/history/42/metadata')).toBeTruthy()
    expect(isAllowedBarkdPath('/api/v1/wallet/addresses/index/7')).toBeTruthy()
  })

  it('allows explicit routes that overlap a parameter route', () => {
    expect(isAllowedBarkdPath('/api/v1/exits/status/all')).toBeTruthy()
    expect(isAllowedBarkdPath('/api/v1/exits/status/live')).toBeTruthy()
    expect(isAllowedBarkdPath('/api/v1/exits/status/anything-else')).toBeTruthy()
  })

  it('blocks the mnemonic route', () => {
    expect(isAllowedBarkdPath('/api/v1/wallet/mnemonic')).toBeFalsy()
  })

  it('blocks the mnemonic route through slash normalization', () => {
    expect(isAllowedBarkdPath('/api/v1/wallet/mnemonic/')).toBeFalsy()
    expect(isAllowedBarkdPath('/api/v1//wallet/mnemonic')).toBeFalsy()
    expect(isAllowedBarkdPath('//api/v1/wallet/mnemonic')).toBeFalsy()
    expect(isAllowedBarkdPath('/api/v1/wallet//mnemonic')).toBeFalsy()
  })

  it('blocks the mnemonic route after path traversal resolves to it', () => {
    // These are the canonical forms `new URL()` produces for `..` traversal that
    // targets the mnemonic route; the allowlist rejects them by default.
    expect(isAllowedBarkdPath('/api/v1/wallet/mnemonic')).toBeFalsy()
    expect(isAllowedBarkdPath('/api/v1/wallet/refresh/../mnemonic')).toBeFalsy()
  })

  it('does not let a parameter segment span into the mnemonic route', () => {
    // No allowed route is `/api/v1/wallet/{param}`, so no single segment can
    // stand in for `mnemonic`, and a param cannot contain a slash to add one.
    expect(isAllowedBarkdPath('/api/v1/wallet/mnemonic')).toBeFalsy()
    expect(isAllowedBarkdPath('/api/v1/wallet/vtxos/../mnemonic')).toBeFalsy()
  })

  it('blocks unknown and near-miss routes', () => {
    expect(isAllowedBarkdPath('/api/v1/wallet/mnemonic-backup')).toBeFalsy()
    expect(isAllowedBarkdPath('/api/v1/wallet/mnemonic/export')).toBeFalsy()
    expect(isAllowedBarkdPath('/api/v2/wallet/balance')).toBeFalsy()
    expect(isAllowedBarkdPath('/api/v1/wallet')).toBeTruthy()
    expect(isAllowedBarkdPath('/api/v1/wallet/')).toBeTruthy()
    expect(isAllowedBarkdPath('/api/v1/wallet/does-not-exist')).toBeFalsy()
    expect(isAllowedBarkdPath('/')).toBeFalsy()
    expect(isAllowedBarkdPath('')).toBeFalsy()
  })

  it('does not allow a parameter route to match with extra segments', () => {
    // `/api/v1/wallet/vtxos/{id}` must not match a deeper path.
    expect(isAllowedBarkdPath('/api/v1/wallet/vtxos/abc/extra')).toBeFalsy()
    expect(isAllowedBarkdPath('/api/v1/exits/cancel/abc/def')).toBeFalsy()
  })

  it('collapses redundant slashes before matching', () => {
    // A trailing slash resolves to the exact route; a doubled slash mid-path
    // collapses so the segments still line up with a real route shape.
    expect(isAllowedBarkdPath('/api/v1/wallet/vtxos/')).toBeTruthy()
    expect(isAllowedBarkdPath('/api/v1/wallet/vtxos/abc//encoded')).toBeTruthy()
  })
})
