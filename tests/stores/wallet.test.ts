import { beforeEach, describe, expect, it } from 'vitest'
import { WALLET_NAME_MAX_LENGTH } from '../../src/constants/wallet'
import { useWalletStore } from '../../src/stores/wallet'

function resetStore() {
  useWalletStore.setState({
    exitClaimAddresses: {},
    isEmergencyExitAllInProgress: false,
    wallet: null
  })
}

describe('wallet store', () => {
  beforeEach(() => {
    resetStore()
  })

  describe('setWallet / clearWallet', () => {
    it('sets and clears a wallet', () => {
      useWalletStore.getState().setWallet({
        createdAt: '2026-05-13T00:00:00Z',
        fingerprint: 'abc',
        name: 'Test'
      })
      expect(useWalletStore.getState().wallet?.name).toBe('Test')

      useWalletStore.getState().clearWallet()
      expect(useWalletStore.getState().wallet).toBeNull()
      expect(useWalletStore.getState().exitClaimAddresses).toStrictEqual({})
      expect(useWalletStore.getState().isEmergencyExitAllInProgress).toBeFalsy()
    })
  })

  describe('updateWalletName', () => {
    beforeEach(() => {
      useWalletStore.getState().setWallet({
        createdAt: '2026-05-13T00:00:00Z',
        fingerprint: 'abc',
        name: 'Initial'
      })
    })

    it('trims whitespace', () => {
      useWalletStore.getState().updateWalletName('  New Name  ')
      expect(useWalletStore.getState().wallet?.name).toBe('New Name')
    })

    it('clamps to WALLET_NAME_MAX_LENGTH', () => {
      const long = 'x'.repeat(WALLET_NAME_MAX_LENGTH + 50)
      useWalletStore.getState().updateWalletName(long)
      expect(useWalletStore.getState().wallet?.name.length).toBe(WALLET_NAME_MAX_LENGTH)
    })

    it('is a no-op for empty input', () => {
      useWalletStore.getState().updateWalletName('   ')
      expect(useWalletStore.getState().wallet?.name).toBe('Initial')
    })

    it('is a no-op when wallet is null', () => {
      useWalletStore.setState({ wallet: null })
      useWalletStore.getState().updateWalletName('Anything')
      expect(useWalletStore.getState().wallet).toBeNull()
    })
  })

  describe('setExitClaimAddresses', () => {
    it('trims and stores an address for each vtxo id', () => {
      useWalletStore.getState().setExitClaimAddresses(['a', 'b'], '  bc1qabc  ')
      expect(useWalletStore.getState().exitClaimAddresses).toStrictEqual({
        a: 'bc1qabc',
        b: 'bc1qabc'
      })
    })

    it('merges without dropping addresses for other vtxos', () => {
      useWalletStore.getState().setExitClaimAddresses(['a'], 'addr-1')
      useWalletStore.getState().setExitClaimAddresses(['b'], 'addr-2')
      expect(useWalletStore.getState().exitClaimAddresses).toStrictEqual({
        a: 'addr-1',
        b: 'addr-2'
      })
    })

    it('removes addresses for the given ids when passed a whitespace-only string', () => {
      useWalletStore.getState().setExitClaimAddresses(['a', 'b'], 'addr-1')
      useWalletStore.getState().setExitClaimAddresses(['a'], '   ')
      expect(useWalletStore.getState().exitClaimAddresses).toStrictEqual({ b: 'addr-1' })
    })
  })

  describe('clearExitClaimAddresses', () => {
    it('removes only the given vtxo ids', () => {
      useWalletStore.getState().setExitClaimAddresses(['a', 'b', 'c'], 'addr-1')
      useWalletStore.getState().clearExitClaimAddresses(['a', 'c'])
      expect(useWalletStore.getState().exitClaimAddresses).toStrictEqual({ b: 'addr-1' })
    })
  })

  describe('setIsEmergencyExitAllInProgress', () => {
    it('toggles the flag', () => {
      useWalletStore.getState().setIsEmergencyExitAllInProgress(true)
      expect(useWalletStore.getState().isEmergencyExitAllInProgress).toBeTruthy()
      useWalletStore.getState().setIsEmergencyExitAllInProgress(false)
      expect(useWalletStore.getState().isEmergencyExitAllInProgress).toBeFalsy()
    })
  })
})
