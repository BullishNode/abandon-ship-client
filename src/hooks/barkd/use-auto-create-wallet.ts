import { generateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { config } from '@/config/barkd'
import { walletApi } from '@/lib/barkd-client'
import { invalidateWalletExistence } from '@/lib/query-invalidations'
import { walletKeys } from '@/lib/query-keys'
import { useWalletStore } from '@/stores/wallet'

const DEFAULT_WALLET_NAME = 'My Wallet'

interface UseAutoCreateWalletOptions {
  enabled: boolean
}

export function useAutoCreateWallet({ enabled }: UseAutoCreateWalletOptions) {
  const queryClient = useQueryClient()
  const { t } = useTranslation()

  return useQuery({
    enabled,
    gcTime: Number.POSITIVE_INFINITY,
    queryFn: async () => {
      const mnemonic = generateMnemonic(wordlist)
      const response = await walletApi.createWallet({
        createWalletRequest: {
          arkServer: config.arkServer,
          chainSource: { esplora: { url: config.chainSource } },
          mnemonic,
          network: config.network
        }
      })

      if (!response.fingerprint) {
        throw new Error(t('errors.create_wallet_failed'))
      }

      useWalletStore.getState().setWallet({
        createdAt: new Date().toISOString(),
        fingerprint: response.fingerprint,
        name: DEFAULT_WALLET_NAME
      })

      await invalidateWalletExistence(queryClient)
      return true
    },
    queryKey: walletKeys.autoCreate(),
    retry: false,
    staleTime: Number.POSITIVE_INFINITY
  })
}
