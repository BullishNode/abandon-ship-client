import { generateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { DEFAULT_WALLET_NAME } from '@/constants/wallet'
import { walletApi } from '@/lib/barkd-client'
import { invalidateWalletExistence } from '@/lib/query-invalidations'
import { walletKeys } from '@/lib/query-keys'
import { useWalletStore } from '@/stores/wallet'
import type { CreateWalletResult } from '@/types/domain/wallet'

interface UseAutoCreateWalletOptions {
  enabled: boolean
}

export type AutoCreateOutcome = 'created' | 'recovered' | 'unsupported'

// The wallet-already-exists check is barkd-specific (matches ResponseError
// bodies). Loaded through a build-time-guarded dynamic import so the vendor
// barkd client is dead-code-eliminated from the wasm bundle, where it can never
// fire (a wasm create never throws a barkd ResponseError).
async function isWalletAlreadyExistsError(error: unknown): Promise<boolean> {
  if (__BACKEND__ === 'wasm') {
    return false
  }
  const { isWalletAlreadyExistsError: check } = await import('@/lib/backend/barkd/errors')
  return await check(error)
}

async function createWalletOrNull(mnemonic: string): Promise<CreateWalletResult | null> {
  try {
    return await walletApi.createWallet({ mnemonic })
  } catch (error) {
    if (await isWalletAlreadyExistsError(error)) {
      return null
    }
    throw error
  }
}

function storeWallet(fingerprint: string): void {
  useWalletStore.getState().setWallet({
    createdAt: new Date().toISOString(),
    fingerprint,
    name: DEFAULT_WALLET_NAME
  })
}

async function autoCreateWasm(queryClient: QueryClient): Promise<AutoCreateOutcome> {
  const { autoCreateWasmWallet } = await import('@/lib/backend/wasm/auto-create')
  const result = await autoCreateWasmWallet()
  if (result.outcome === 'unsupported') {
    return 'unsupported'
  }
  storeWallet(result.fingerprint)
  await invalidateWalletExistence(queryClient)
  return 'created'
}

async function autoCreateBarkd(
  queryClient: QueryClient,
  failureMessage: string
): Promise<AutoCreateOutcome> {
  const mnemonic = generateMnemonic(wordlist)
  const response = await createWalletOrNull(mnemonic)
  if (response === null) {
    await invalidateWalletExistence(queryClient)
    return 'recovered'
  }
  if (!response.fingerprint) {
    throw new Error(failureMessage)
  }
  storeWallet(response.fingerprint)
  await invalidateWalletExistence(queryClient)
  return 'created'
}

export function useAutoCreateWallet({ enabled }: UseAutoCreateWalletOptions) {
  const queryClient = useQueryClient()
  const { t } = useTranslation()

  return useQuery({
    enabled,
    gcTime: Number.POSITIVE_INFINITY,
    queryFn: async (): Promise<AutoCreateOutcome> => {
      if (__BACKEND__ === 'wasm') {
        return await autoCreateWasm(queryClient)
      }
      return await autoCreateBarkd(queryClient, t('errors.create_wallet_failed'))
    },
    queryKey: walletKeys.autoCreate(),
    retry: false,
    staleTime: Number.POSITIVE_INFINITY
  })
}
