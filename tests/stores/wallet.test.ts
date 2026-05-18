import { beforeEach, describe, expect, it } from 'vitest'
import { WALLET_NAME_MAX_LENGTH } from '../../src/constants/wallet'
import { useWalletStore } from '../../src/stores/wallet'

function resetStore() {
  useWalletStore.setState({ pendingExitClaimAddress: null, wallet: null })
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
      expect(useWalletStore.getState().pendingExitClaimAddress).toBeNull()
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

  describe('setPendingExitClaimAddress', () => {
    it('trims and stores a non-empty address', () => {
      useWalletStore.getState().setPendingExitClaimAddress('  bc1qabc  ')
      expect(useWalletStore.getState().pendingExitClaimAddress).toBe('bc1qabc')
    })

    it('clears when given null', () => {
      useWalletStore.setState({ pendingExitClaimAddress: 'bc1q' })
      useWalletStore.getState().setPendingExitClaimAddress(null)
      expect(useWalletStore.getState().pendingExitClaimAddress).toBeNull()
    })

    it('clears when given a whitespace-only string', () => {
      useWalletStore.setState({ pendingExitClaimAddress: 'bc1q' })
      useWalletStore.getState().setPendingExitClaimAddress('   ')
      expect(useWalletStore.getState().pendingExitClaimAddress).toBeNull()
    })
  })
})
