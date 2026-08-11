import { describe, expect, it } from 'vitest'
import { isBlockedBarkdSubPath } from '../../api/src/barkd-proxy.ts'

describe(isBlockedBarkdSubPath, () => {
  it('blocks the canonical mnemonic path', () => {
    expect(isBlockedBarkdSubPath('/api/v1/wallet/mnemonic')).toBeTruthy()
  })

  it('blocks a trailing-slash variant', () => {
    expect(isBlockedBarkdSubPath('/api/v1/wallet/mnemonic/')).toBeTruthy()
    expect(isBlockedBarkdSubPath('/api/v1/wallet/mnemonic///')).toBeTruthy()
  })

  it('blocks repeated-slash variants', () => {
    expect(isBlockedBarkdSubPath('/api/v1//wallet/mnemonic')).toBeTruthy()
    expect(isBlockedBarkdSubPath('//api/v1/wallet/mnemonic')).toBeTruthy()
  })

  it('blocks mixed-case variants', () => {
    expect(isBlockedBarkdSubPath('/api/v1/wallet/MNEMONIC')).toBeTruthy()
    expect(isBlockedBarkdSubPath('/API/V1/Wallet/Mnemonic')).toBeTruthy()
  })

  it('blocks percent-encoded variants', () => {
    expect(isBlockedBarkdSubPath('/api/v1/wallet/mnemoni%63')).toBeTruthy()
    expect(isBlockedBarkdSubPath('/api/v1%2fwallet/mnemonic')).toBeTruthy()
  })

  it('fails closed on malformed percent-encoding', () => {
    expect(isBlockedBarkdSubPath('/api/v1/wallet/mnemonic%')).toBeTruthy()
    expect(isBlockedBarkdSubPath('/api/v1/wallet/%zz')).toBeTruthy()
  })

  it('allows unrelated wallet routes', () => {
    expect(isBlockedBarkdSubPath('/api/v1/wallet/address')).toBeFalsy()
    expect(isBlockedBarkdSubPath('/api/v1/wallet/send')).toBeFalsy()
    expect(isBlockedBarkdSubPath('/api/v1/wallet/balance')).toBeFalsy()
  })

  it('does not over-block paths that merely contain the segment', () => {
    expect(isBlockedBarkdSubPath('/api/v1/wallet/mnemonic-backup')).toBeFalsy()
    expect(isBlockedBarkdSubPath('/api/v1/wallet/mnemonic/export')).toBeFalsy()
    expect(isBlockedBarkdSubPath('/api/v2/wallet/mnemonic')).toBeFalsy()
  })
})
