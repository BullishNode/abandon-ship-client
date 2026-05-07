import { WalletApi } from '@secondts/barkd'
import type { WalletVtxoInfo } from '@secondts/barkd'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { config } from '@/config/barkd'
import { walletKeys } from '@/lib/query-keys'

const walletApi = new WalletApi(config)

type UseVtxosOptions = Omit<UseQueryOptions<WalletVtxoInfo[]>, 'queryKey' | 'queryFn'> & {
  all?: boolean
}

export function useVtxos(options?: UseVtxosOptions) {
  const { all = false, ...queryOptions } = options ?? {}

  return useQuery({
    queryFn: async () => {
      const vtxos = await walletApi.vtxos({ all })
      return vtxos
    },
    queryKey: walletKeys.vtxos({ all }),
    refetchInterval: 10_000,
    ...queryOptions
  })
}
