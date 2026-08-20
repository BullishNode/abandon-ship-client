import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { DecodedPayment, Destination } from 'bitcoin-decoder'
import { decode } from 'bitcoin-decoder'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig } from '../../src/config/runtime'
import { __setRuntimeConfigForTests } from '../../src/config/runtime'
import { useSendFlow } from '../../src/hooks/use-send-flow'
import { feesApi, onchainApi, walletApi } from '../../src/lib/barkd-client'
import { walletKeys } from '../../src/lib/query-keys'
import type { Balance, OnchainBalance } from '@/types/domain/balance'
import type { SendResult } from '@/types/domain/wallet'

vi.mock(import('bitcoin-decoder'), () => ({
  decode: vi.fn<typeof decode>()
}))

const TEST_CONFIG: RuntimeConfig = {
  arkServer: 'http://localhost:3535',
  chainSource: { esplora: { url: 'http://localhost:18443' } },
  network: 'signet',
  walletDataPath: '/data/.bark/'
}

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

const NETWORK_DISABLED = new Error('network disabled in tests')

// Must stay `async`: the fetch stub has to reject rather than throw synchronously.
// oxlint-disable-next-line eslint/require-await
async function rejectNetworkAccess() {
  throw NETWORK_DISABLED
}

const ONCHAIN_DEST: Destination = {
  addressType: 'p2wpkh',
  destination: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
  protocol: 'on-chain',
  type: 'bitcoin-address'
}

const MAINNET_ONCHAIN_DEST: Destination = {
  addressType: 'p2wpkh',
  destination: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
  protocol: 'on-chain',
  type: 'bitcoin-address'
}

const REGTEST_ONCHAIN_DEST: Destination = {
  addressType: 'p2wpkh',
  destination: 'bcrt1qw508d6qejxtdg4y5r3zarvary0c5xw7kygt080',
  protocol: 'on-chain',
  type: 'bitcoin-address'
}

const LNADDRESS_DEST: Destination = {
  destination: 'carlos@second.tech',
  protocol: 'lightning',
  type: 'lnaddress'
}

const OFFER_DEST: Destination = {
  destination: 'lno1pqqnyzsmx5cx6umpwssx6atvw35j6ut4v9h9g',
  protocol: 'lightning',
  type: 'bolt12'
}

const MAINNET_INVOICE_DEST: Destination = {
  destination: 'lnbc500u1p3invoice',
  protocol: 'lightning',
  type: 'bolt11'
}

function makePayment(
  network: DecodedPayment['network'],
  destinations: Destination[] = [ONCHAIN_DEST]
): DecodedPayment {
  return {
    destination: destinations[0],
    destinations,
    input: destinations[0].destination,
    kind: 'payment',
    network,
    valid: true
  }
}

function renderSendFlow(client: QueryClient) {
  return renderHook(
    () => useSendFlow({ onOpenChange: vi.fn<(open: boolean) => void>(), open: true }),
    { wrapper: makeWrapper(client) }
  )
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

  const toastErrorSpy = vi.spyOn(toast, 'error')

  beforeEach(() => {
    toastErrorSpy.mockReset()
    toastErrorSpy.mockReturnValue('toast-id')
    vi.stubGlobal('fetch', vi.fn(rejectNetworkAccess))
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
    __setRuntimeConfigForTests(TEST_CONFIG)
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

  it('shows feedback when manual entry is not decodable', async () => {
    vi.mocked(decode).mockResolvedValue({
      errorCode: 'UNKNOWN_FORMAT',
      errorMessage: 'unknown format',
      input: 'nonsense',
      valid: false
    })
    const { result } = renderSendFlow(queryClient)

    await act(async () => {
      await result.current.verifyDestination('nonsense')
    })

    expect(toastErrorSpy).toHaveBeenCalledWith('Invalid destination', {
      description: 'unknown format'
    })
    expect(result.current.selectedMethodType).toBeUndefined()
  })

  it('shows feedback when manual entry is on another network', async () => {
    vi.mocked(decode).mockResolvedValue(makePayment('mainnet', [MAINNET_ONCHAIN_DEST]))
    const { result } = renderSendFlow(queryClient)

    await act(async () => {
      await result.current.verifyDestination(MAINNET_ONCHAIN_DEST.destination)
    })

    expect(toastErrorSpy).toHaveBeenCalledWith('The destination is for a different network')
    expect(result.current.selectedMethodType).toBeUndefined()
  })

  it('applies a scanned destination that matches the wallet network', async () => {
    vi.mocked(decode).mockResolvedValue(makePayment('testnet'))
    const { result } = renderSendFlow(queryClient)

    await act(async () => {
      await result.current.goToSend(ONCHAIN_DEST.destination)
    })

    expect(result.current.selectedMethodType).toBe('bitcoin-address')
    expect(toastErrorSpy).not.toHaveBeenCalled()
  })

  it('rejects a scanned destination from another network', async () => {
    vi.mocked(decode).mockResolvedValue(makePayment('mainnet', [MAINNET_ONCHAIN_DEST]))
    const { result } = renderSendFlow(queryClient)

    await act(async () => {
      await result.current.goToSend(MAINNET_ONCHAIN_DEST.destination)
    })

    expect(toastErrorSpy).toHaveBeenCalledWith('The destination is for a different network')
    expect(result.current.selectedMethodType).toBeUndefined()
    expect(result.current.chooserDestinations).toStrictEqual([])
    expect(result.current.canSend).toBeFalsy()
  })

  it('rejects an address from another test network', async () => {
    vi.mocked(decode).mockResolvedValue(makePayment('testnet', [REGTEST_ONCHAIN_DEST]))
    const { result } = renderSendFlow(queryClient)

    await act(async () => {
      await result.current.goToSend(REGTEST_ONCHAIN_DEST.destination)
    })

    expect(toastErrorSpy).toHaveBeenCalledWith('The destination is for a different network')
    expect(result.current.selectedMethodType).toBeUndefined()
  })

  it('rejects a unified URI when none of its rails are on the wallet network', async () => {
    vi.mocked(decode).mockResolvedValue(
      makePayment('mainnet', [MAINNET_INVOICE_DEST, MAINNET_ONCHAIN_DEST])
    )
    const { result } = renderSendFlow(queryClient)

    await act(async () => {
      await result.current.goToSend('bitcoin:mainnet-uri')
    })

    expect(toastErrorSpy).toHaveBeenCalledWith('The destination is for a different network')
    expect(result.current.chooserDestinations).toStrictEqual([])
    expect(result.current.canSend).toBeFalsy()
  })

  it('drops only the off-network rails of a unified URI', async () => {
    vi.mocked(decode).mockResolvedValue(
      makePayment('unknown', [LNADDRESS_DEST, MAINNET_ONCHAIN_DEST])
    )
    const { result } = renderSendFlow(queryClient)

    await act(async () => {
      await result.current.goToSend('bitcoin:mixed-uri')
    })

    expect(toastErrorSpy).not.toHaveBeenCalled()
    expect(result.current.chooserDestinations).toStrictEqual([LNADDRESS_DEST])
    expect(result.current.destination).toBe(LNADDRESS_DEST.destination)
    expect(result.current.selectedMethodType).toBe('lnaddress')
  })

  it('accepts destinations the decoder cannot place on a network', async () => {
    vi.mocked(decode).mockResolvedValue(makePayment('mainnet', [OFFER_DEST]))
    const { result } = renderSendFlow(queryClient)

    await act(async () => {
      await result.current.goToSend(OFFER_DEST.destination)
    })

    expect(toastErrorSpy).not.toHaveBeenCalled()
    expect(result.current.selectedMethodType).toBe('bolt12')
  })

  it('accepts a mainnet URI whose network the decoder read off the lightning rail', async () => {
    __setRuntimeConfigForTests({ ...TEST_CONFIG, network: 'mainnet' })
    vi.mocked(decode).mockResolvedValue(
      makePayment('testnet', [LNADDRESS_DEST, MAINNET_ONCHAIN_DEST])
    )
    const { result } = renderSendFlow(queryClient)

    await act(async () => {
      await result.current.goToSend('bitcoin:mainnet-uri')
    })

    expect(toastErrorSpy).not.toHaveBeenCalled()
    expect(result.current.chooserDestinations).toStrictEqual([LNADDRESS_DEST, MAINNET_ONCHAIN_DEST])
    expect(result.current.selectedMethodType).toBe('lnaddress')
  })

  it('reports the rejection again when manual entry repeats a rejected scan', async () => {
    vi.mocked(decode).mockResolvedValue(makePayment('mainnet', [MAINNET_ONCHAIN_DEST]))
    const { result } = renderSendFlow(queryClient)

    await act(async () => {
      await result.current.goToSend(MAINNET_ONCHAIN_DEST.destination)
    })
    act(() => {
      result.current.changeDestination(MAINNET_ONCHAIN_DEST.destination)
    })
    await act(async () => {
      await result.current.verifyDestination(MAINNET_ONCHAIN_DEST.destination)
    })

    expect(toastErrorSpy).toHaveBeenCalledTimes(2)
    expect(toastErrorSpy).toHaveBeenLastCalledWith('The destination is for a different network')
    expect(result.current.canSend).toBeFalsy()
  })

  it('drops the accepted destination when the next one is rejected', async () => {
    vi.mocked(decode).mockResolvedValue(makePayment('testnet'))
    const { result } = renderSendFlow(queryClient)

    await act(async () => {
      await result.current.goToSend(ONCHAIN_DEST.destination)
    })
    act(() => {
      result.current.setAmountSat(SEND_AMOUNT_SATS)
    })
    expect(result.current.selectedMethodType).toBe('bitcoin-address')

    vi.mocked(decode).mockResolvedValue(makePayment('mainnet', [MAINNET_ONCHAIN_DEST]))
    await act(async () => {
      await result.current.goToSend(MAINNET_ONCHAIN_DEST.destination)
    })

    expect(toastErrorSpy).toHaveBeenCalledWith('The destination is for a different network')
    expect(result.current.selectedMethodType).toBeUndefined()
    expect(result.current.canSend).toBeFalsy()
  })

  it('does not verify a rejected destination with branta', async () => {
    vi.mocked(decode).mockResolvedValue(makePayment('mainnet', [MAINNET_ONCHAIN_DEST]))
    const { result } = renderSendFlow(queryClient)

    await act(async () => {
      await result.current.goToSend(ONCHAIN_DEST.destination)
    })
    await act(async () => {
      await result.current.goToSend(MAINNET_ONCHAIN_DEST.destination)
    })

    expect(result.current.isFetchingBranta).toBeFalsy()
    expect(result.current.brantaPayment).toBeUndefined()
  })

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
