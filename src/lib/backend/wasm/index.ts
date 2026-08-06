export {
  isWalletLocked,
  tryDeviceUnlock,
  unlockWallet,
  WalletLockedError,
  wasmBackend
} from '@/lib/backend/wasm/client'
export type { DeviceUnlockResult } from '@/lib/backend/wasm/client'
export {
  clearDeviceVault,
  isDeviceVaultSupported,
  saveDeviceVault
} from '@/lib/backend/wasm/device-vault'
export {
  clearVault,
  hasVault,
  InvalidPasswordError,
  openVault,
  saveVault
} from '@/lib/backend/wasm/vault'
