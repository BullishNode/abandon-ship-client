import { generateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import { BarkNetwork, WalletApi } from '@secondts/barkd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { config } from '@/config/barkd'
import { invalidateWalletExistence } from '@/lib/query-invalidations'
import { walletKeys } from '@/lib/query-keys'
import { useWalletStore } from '@/stores/wallet'

const walletApi = new WalletApi(config)

const DEFAULT_WALLET_NAME = 'My wallet'
const DEFAULT_ARK_SERVER = 'https://ark.signet.2nd.dev'
const DEFAULT_CHAIN_SOURCE = 'https://esplora.signet.2nd.dev'

interface UseAutoCreateWalletOptions {
  enabled: boolean
}

export function useAutoCreateWallet({ enabled }: UseAutoCreateWalletOptions) {
  const queryClient = useQueryClient()

  return useQuery({
    enabled,
    gcTime: Number.POSITIVE_INFINITY,
    queryFn: async () => {
      const mnemonic = generateMnemonic(wordlist)
      const response = await walletApi.createWallet({
        createWalletRequest: {
          arkServer: DEFAULT_ARK_SERVER,
          chainSource: { esplora: { url: DEFAULT_CHAIN_SOURCE } },
          mnemonic,
          network: BarkNetwork.Signet
        }
      })

      if (!response.fingerprint) {
        throw new Error('Failed to create wallet')
      }

      useWalletStore.getState().setWallet({
        createdAt: new Date().toISOString(),
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
