import { walletApi } from '@/lib/barkd-client'

// The dynamic imports are guarded by the build-time backend literal so the WASM
// vault (and its worker) is dead-code-eliminated from barkd bundles.

// The device vault written by `createWallet` is dropped afterwards — leaving it
// would keep reloads unlocking silently, making the password decorative.
export async function persistOnboardingPassword(password: string): Promise<void> {
  if (__BACKEND__ !== 'wasm') {
    return
  }
  const { clearDeviceVault, saveVault } = await import('@/lib/backend/wasm')
  const mnemonic = await walletApi.mnemonic()
  await saveVault(mnemonic, password)
  await clearDeviceVault()
}

// False in private modes that reject the non-extractable device key, where
// skipping the password means retyping the seed phrase on every visit.
export async function isSilentUnlockSupported(): Promise<boolean> {
  if (__BACKEND__ !== 'wasm') {
    return true
  }
  const { isDeviceVaultSupported } = await import('@/lib/backend/wasm')
  return await isDeviceVaultSupported()
}
