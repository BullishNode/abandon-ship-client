import { BarkNetwork } from '@secondts/barkd'
import type { QueryClient } from '@tanstack/react-query'
import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCreateWallet } from '../../src/hooks/barkd/use-create-wallet'
import { walletApi } from '../../src/lib/barkd-client'
import { useWalletStore } from '../../src/stores/wallet'
import { createTestQueryClient } from '../utils/render'

const CHAIN_SOURCE = {
  bitcoind: {
    bitcoind: '127.0.0.1:38332',
    bitcoindAuth: { cookie: { cookie: '/root/.bitcoin/signet/.cookie' } }
  }
} as const

function makeWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe(useCreateWallet, () => {
  let queryClient: QueryClient
  const createWalletSpy = vi.spyOn(walletApi, 'createWallet')

  beforeEach(() => {
    queryClient = createTestQueryClient()
    createWalletSpy.mockReset()
    createWalletSpy.mockResolvedValue({ fingerprint: 'f00dbabe' })
    useWalletStore.setState({ wallet: null })
  })

  async function create(birthdayHeight?: number) {
    const { result } = renderHook(() => useCreateWallet(), {
      wrapper: makeWrapper(queryClient)
    })
    result.current.mutate({
      arkServer: 'https://ark.signet.2nd.dev',
      birthdayHeight,
      chainSource: CHAIN_SOURCE,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      mnemonic: 'test mnemonic',
      name: 'wallet',
      network: BarkNetwork.Signet
    })
    await waitFor(() => {
      expect(createWalletSpy).toHaveBeenCalledOnce()
    })
    return createWalletSpy.mock.calls[0][0].createWalletRequest
  }

  it('forwards the birthday height when one is supplied', async () => {
    const request = await create(850_000)
    expect(request.birthdayHeight).toBe(850_000)
  })

  it('omits the birthday height when none is supplied', async () => {
    const request = await create()
    expect(request.birthdayHeight).toBeUndefined()
  })

  it('forwards the chain source union verbatim', async () => {
    const request = await create()
    expect(request.chainSource).toStrictEqual(CHAIN_SOURCE)
  })
})
