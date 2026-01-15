import { useQuery, type UseQueryOptions } from '@tanstack/react-query'

const PROXY_URL = import.meta.env.VITE_PROXY_URL

interface CheckWalletResponse {
  exists: boolean
}

async function checkWallet() {
  const response = await fetch(`${PROXY_URL}/api/v1/wallet`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error('Failed to check wallet existence')
  }

  const data: CheckWalletResponse = await response.json()
  return data.exists
}

export function useCheckWallet(
  options?: Omit<UseQueryOptions<boolean, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: ['wallet', 'exists'],
    queryFn: checkWallet,
    ...options
  })
}
