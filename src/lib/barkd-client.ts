import { backend } from '@/lib/backend'

// The selected backend (barkd REST or WASM) is exposed under these stable names
// so hooks keep their existing import paths. Both backends implement the same
// domain-typed interfaces from '@/types/backend'.
export const { walletApi } = backend
export const { boardsApi } = backend
export const { historyApi } = backend
export const { onchainApi } = backend
export const { feesApi } = backend
export const { lightningApi } = backend
export const { exitsApi } = backend
export const { bitcoinApi } = backend
