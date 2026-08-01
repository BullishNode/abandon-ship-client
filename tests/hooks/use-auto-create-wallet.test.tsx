import { BarkNetwork, Configuration, ResponseError } from '@secondts/barkd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __setRuntimeConfigForTests } from '../../src/config/barkd'
import { useAutoCreateWallet } from '../../src/hooks/barkd/use-auto-create-wallet'
import { useCheckWallet } from '../../src/hooks/barkd/use-check-wallet'
import { walletApi } from '../../src/lib/barkd-client'
import { walletKeys } from '../../src/lib/query-keys'
import { useWalletStore } from '../../src/stores/wallet'

function makeWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function makeResponseError(body: unknown, status = 500) {
  const response = Response.json(body, { status })
  return new ResponseError(response, 'Response returned an error code')
}

describe(useAutoCreateWallet, () => {
  let queryClient: QueryClient
  const createWalletSpy = vi.spyOn(walletApi, 'createWallet')

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } }
    })
    createWalletSpy.mockReset()
    useWalletStore.setState({ wallet: null })
    __setRuntimeConfigForTests({
      arkServer: 'https://ark.example.com',
      chainSource: { esplora: { url: 'https://mempool.example.com/api' } },
      client: new Configuration({ basePath: '/api/barkd' }),
      network: BarkNetwork.Signet,
      walletDataPath: '/data/.bark/'
    })
  })

  afterEach(() => {
    queryClient.clear()
  })

  it('creates a wallet and stores the fingerprint', async () => {
    createWalletSpy.mockResolvedValue({ fingerprint: 'f00dbabe' })
    const { result } = renderHook(() => useAutoCreateWallet({ enabled: true }), {
      wrapper: makeWrapper(queryClient)
    })
    await waitFor(() => {
      expect(result.current.data).toBeTruthy()
    })
    expect(createWalletSpy).toHaveBeenCalledOnce()
    expect(useWalletStore.getState().wallet?.fingerprint).toBe('f00dbabe')
  })

  it('treats "datadir has unexpected contents" as wallet already existing', async () => {
    createWalletSpy.mockRejectedValue(
      makeResponseError({ message: 'Datadir has unexpected contents: /data/.bark/db.sqlite' })
    )
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useAutoCreateWallet({ enabled: true }), {
      wrapper: makeWrapper(queryClient)
    })
    await waitFor(() => {
      expect(result.current.data).toBeTruthy()
    })
    expect(result.current.error).toBeNull()
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: walletKeys.exists() })
    expect(useWalletStore.getState().wallet).toBeNull()
  })

  it('treats "Wallet already set" as wallet already existing', async () => {
    createWalletSpy.mockRejectedValue(makeResponseError({ message: 'Wallet already set' }, 400))
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useAutoCreateWallet({ enabled: true }), {
      wrapper: makeWrapper(queryClient)
    })
    await waitFor(() => {
      expect(result.current.data).toBeTruthy()
    })
    expect(result.current.error).toBeNull()
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: walletKeys.exists() })
  })

  it('recovers end-to-end: failed create triggers a re-check that finds the wallet', async () => {
    const walletExistsSpy = vi
      .spyOn(walletApi, 'walletExists')
      .mockResolvedValueOnce({ fingerprint: null })
      .mockResolvedValue({ fingerprint: 'f00dbabe' })
    createWalletSpy.mockRejectedValue(
      makeResponseError({ message: 'Datadir has unexpected contents: /data/.bark/db.sqlite' })
    )
    const { result } = renderHook(
      () => {
        const check = useCheckWallet({ staleTime: 0 })
        const create = useAutoCreateWallet({ enabled: check.data === false })
        return { check, create }
      },
      { wrapper: makeWrapper(queryClient) }
    )
    await waitFor(() => {
      expect(result.current.check.data).toBeTruthy()
    })
    expect(result.current.create.data).toBeTruthy()
    expect(result.current.create.error).toBeNull()
    expect(createWalletSpy).toHaveBeenCalledOnce()
    expect(useWalletStore.getState().wallet?.fingerprint).toBe('f00dbabe')
    walletExistsSpy.mockRestore()
  })

  it('surfaces an error when create returns an empty fingerprint', async () => {
    createWalletSpy.mockResolvedValue({ fingerprint: '' })
    const { result } = renderHook(() => useAutoCreateWallet({ enabled: true }), {
      wrapper: makeWrapper(queryClient)
    })
    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error)
    })
    expect(result.current.error?.message).toBe('Failed to create wallet')
  })

  it('surfaces other barkd response errors', async () => {
    createWalletSpy.mockRejectedValue(makeResponseError({ message: 'Internal error' }))
    const { result } = renderHook(() => useAutoCreateWallet({ enabled: true }), {
      wrapper: makeWrapper(queryClient)
    })
    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(ResponseError)
    })
    expect(result.current.data).toBeUndefined()
  })

  it('surfaces network-level errors unchanged', async () => {
    createWalletSpy.mockRejectedValue(new TypeError('Failed to fetch'))
    const { result } = renderHook(() => useAutoCreateWallet({ enabled: true }), {
      wrapper: makeWrapper(queryClient)
    })
    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(TypeError)
    })
    expect(createWalletSpy).toHaveBeenCalledOnce()
  })
})
