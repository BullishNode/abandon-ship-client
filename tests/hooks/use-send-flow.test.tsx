import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { decode } from 'bitcoin-decoder'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSendFlow } from '../../src/hooks/use-send-flow'
import { feesApi, onchainApi, walletApi } from '../../src/lib/barkd-client'
import { walletKeys } from '../../src/lib/query-keys'
import type { Balance, OnchainBalance } from '@/types/domain/balance'
import type { SendResult } from '@/types/domain/wallet'

vi.mock(import('bitcoin-decoder'), () => ({
  decode: vi.fn<typeof decode>()
}))

const SPENDABLE_SATS = 100_000
const SEND_AMOUNT_SATS = 50_000
const FEE_SATS = 100
const INVOICE = 'lnbc500u1p3invoice'

const ONCHAIN_BALANCE: OnchainBalance = {
  confirmedSats: 0,
  immatureSats: 0,
  totalSats: 0,
  trustedPendingSats: 0,
  trustedSpendableSats: 0,
  untrustedPendingSats: 0
}

function makeBalance(spendableSats: number, pendingLightningSendSats = 0): Balance {
  return {
    claimableLightningReceiveSats: 0,
    pendingBoardSats: 0,
    pendingExitSats: 0,
    pendingInRoundSats: 0,
    pendingLightningSendSats,
    spendableSats
  }
}

function makeWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe(useSendFlow, () => {
  let queryClient: QueryClient
  const balanceSpy = vi.spyOn(walletApi, 'balance')
  const sendSpy = vi.spyOn(walletApi, 'send')
  const lightningSendFeeSpy = vi.spyOn(feesApi, 'lightningSendFee')
  const onchainBalanceSpy = vi.spyOn(onchainApi, 'onchainBalance')
  const onchainTransactionsSpy = vi.spyOn(onchainApi, 'onchainTransactions')
  const onchainUtxosSpy = vi.spyOn(onchainApi, 'onchainUtxos')

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('network disabled in tests')))
    )
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } }
    })
    balanceSpy.mockReset()
    balanceSpy.mockResolvedValue(makeBalance(SPENDABLE_SATS))
    sendSpy.mockReset()
    lightningSendFeeSpy.mockReset()
    lightningSendFeeSpy.mockResolvedValue({
      feeSats: FEE_SATS,
      grossAmountSats: SEND_AMOUNT_SATS + FEE_SATS,
      netAmountSats: SEND_AMOUNT_SATS,
      vtxosSpent: []
    })
    onchainBalanceSpy.mockReset()
    onchainBalanceSpy.mockResolvedValue(ONCHAIN_BALANCE)
    onchainTransactionsSpy.mockReset()
    onchainTransactionsSpy.mockResolvedValue([])
    onchainUtxosSpy.mockReset()
    onchainUtxosSpy.mockResolvedValue([])
  })

  afterEach(() => {
    queryClient.clear()
    vi.unstubAllGlobals()
  })

  async function renderLightningSend() {
    const onOpenChange = vi.fn<(open: boolean) => void>()
    const { result } = renderHook(
      () => useSendFlow({ initialStep: 'send', onOpenChange, open: true }),
      { wrapper: makeWrapper(queryClient) }
    )

    act(() => {
      result.current.applyDestination({
        destination: INVOICE,
        protocol: 'lightning',
        type: 'bolt11'
      })
      result.current.setAmountSat(SEND_AMOUNT_SATS)
    })

    await waitFor(() => {
      expect(result.current.canSend).toBeTruthy()
    })

    return { onOpenChange, result }
  }

  async function dropSpendableBalanceToZero(getAvailableBalance: () => number) {
    balanceSpy.mockResolvedValue(makeBalance(0, SEND_AMOUNT_SATS + FEE_SATS))
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: walletKeys.balance() })
    })
    await waitFor(() => {
      expect(getAvailableBalance()).toBe(0)
    })
  }

  function deferSend() {
    const settle: { fail?: () => void; succeed?: () => void } = {}
    sendSpy.mockImplementation(
      async () =>
        // oxlint-disable-next-line promise/avoid-new
        await new Promise<SendResult>((resolve, reject) => {
          settle.succeed = () => resolve({ message: 'Lightning payment sent' })
          settle.fail = () => reject(new Error('payment failed'))
        })
    )
    return settle
  }

  it('keeps the amount valid while the send that spent the balance is in flight', async () => {
    const settle = deferSend()
    const { onOpenChange, result } = await renderLightningSend()

    act(() => {
      result.current.handleConfirmSend()
    })
    await waitFor(() => {
      expect(result.current.isSending).toBeTruthy()
    })

    await dropSpendableBalanceToZero(() => result.current.availableBalance)

    expect(result.current.insufficientFunds).toBeFalsy()

    await act(async () => {
      settle.succeed?.()
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it('reports insufficient funds when the balance drops with no send in flight', async () => {
    const { result } = await renderLightningSend()

    await dropSpendableBalanceToZero(() => result.current.availableBalance)

    expect(result.current.insufficientFunds).toBeTruthy()
  })

  it('reports insufficient funds again once a failed send settles', async () => {
    const settle = deferSend()
    const { result } = await renderLightningSend()

    await dropSpendableBalanceToZero(() => result.current.availableBalance)
    act(() => {
      result.current.handleConfirmSend()
    })

    await waitFor(() => {
      expect(result.current.isSending).toBeTruthy()
    })
    expect(result.current.insufficientFunds).toBeFalsy()

    await act(async () => {
      settle.fail?.()
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(result.current.isSending).toBeFalsy()
    })
    expect(result.current.insufficientFunds).toBeTruthy()
  })
})
