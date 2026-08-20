import type { QueryClient } from '@tanstack/react-query'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BoardModal } from '../../src/components/board-modal'
import { boardsApi, feesApi, onchainApi, walletApi } from '../../src/lib/barkd-client'
import { krakenProvider } from '../../src/lib/price-providers/kraken'
import { createTestQueryClient, renderWithProviders } from '../utils/render'
import type { ArkInfo } from '@/types/domain/ark'
import type { OnchainBalance } from '@/types/domain/balance'
import type { FeeEstimate } from '@/types/domain/fees'
import type { PriceData } from '@/types/price-providers'

const SPENDABLE_SATS = 100_000
const AMOUNT_SATS = 50_000
const FEE_SATS = 500

const ONCHAIN_BALANCE: OnchainBalance = {
  confirmedSats: SPENDABLE_SATS,
  immatureSats: 0,
  totalSats: SPENDABLE_SATS,
  trustedPendingSats: 0,
  trustedSpendableSats: SPENDABLE_SATS,
  untrustedPendingSats: 0
}

const ARK_INFO: ArkInfo = {
  fees: {
    board: { baseFeeSats: 0, minFeeSats: 0, ppm: 0 },
    lightningReceive: { baseFeeSats: 0, ppm: 0 },
    lightningSend: { baseFeeSats: 0, minFeeSats: 0, ppmExpiryTable: [] },
    offboard: { baseFeeSats: 0, fixedAdditionalVb: 0, ppmExpiryTable: [] },
    refresh: { baseFeeSats: 0, ppmExpiryTable: [] }
  },
  htlcExpiryDelta: 6,
  htlcSendExpiryDelta: 6,
  lnReceiveAntiDosRequired: false,
  maxUserInvoiceCltvDelta: 144,
  maxVtxoExitDepth: 4,
  minBoardAmountSats: 5000,
  nbRoundNonces: 2,
  network: 'signet',
  requiredBoardConfirmations: 1,
  roundInterval: '30s',
  serverPubkey: '02deadbeef',
  vtxoExitDelta: 12,
  vtxoExpiryDelta: 144
}

const FEE: FeeEstimate = {
  feeSats: FEE_SATS,
  grossAmountSats: AMOUNT_SATS,
  netAmountSats: AMOUNT_SATS - FEE_SATS,
  vtxosSpent: []
}

const PRICE: PriceData = {
  change24h: 0,
  changePercent24h: 0,
  currentPrice: 100_000,
  priceHistory: [100_000]
}

// The modal renders a drawer on mobile and a dialog on desktop; jsdom reports no
// matches by default, so force the desktop branch.
function useDesktopViewport() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      addEventListener: vi.fn<() => void>(),
      addListener: vi.fn<() => void>(),
      dispatchEvent: vi.fn<() => boolean>(),
      matches: query.includes('min-width'),
      media: query,
      onchange: null,
      removeEventListener: vi.fn<() => void>(),
      removeListener: vi.fn<() => void>()
    }),
    writable: true
  })
}

describe(BoardModal, () => {
  let queryClient: QueryClient
  const arkInfoSpy = vi.spyOn(walletApi, 'arkInfo')
  const boardFeeSpy = vi.spyOn(feesApi, 'boardFee')
  const boardAllSpy = vi.spyOn(boardsApi, 'boardAll')
  const boardAmountSpy = vi.spyOn(boardsApi, 'boardAmount')
  const onchainBalanceSpy = vi.spyOn(onchainApi, 'onchainBalance')
  const onchainTransactionsSpy = vi.spyOn(onchainApi, 'onchainTransactions')
  const onchainUtxosSpy = vi.spyOn(onchainApi, 'onchainUtxos')
  const fetchPriceSpy = vi.spyOn(krakenProvider, 'fetchPrice')

  beforeEach(() => {
    useDesktopViewport()
    queryClient = createTestQueryClient()
    arkInfoSpy.mockReset()
    arkInfoSpy.mockResolvedValue(ARK_INFO)
    boardFeeSpy.mockReset()
    boardAllSpy.mockReset()
    boardAmountSpy.mockReset()
    onchainBalanceSpy.mockReset()
    onchainBalanceSpy.mockResolvedValue(ONCHAIN_BALANCE)
    onchainTransactionsSpy.mockReset()
    onchainTransactionsSpy.mockResolvedValue([])
    onchainUtxosSpy.mockReset()
    onchainUtxosSpy.mockResolvedValue([])
    fetchPriceSpy.mockReset()
    fetchPriceSpy.mockResolvedValue(PRICE)
  })

  async function renderModal() {
    renderWithProviders(<BoardModal onOpenChange={vi.fn<(open: boolean) => void>()} open />, {
      queryClient
    })
    const input = await screen.findByLabelText('Amount')
    await userEvent.type(input, String(AMOUNT_SATS))
    return screen.getByRole('button', { name: 'Board' })
  }

  it('shows the fee estimate and enables the confirm button', async () => {
    boardFeeSpy.mockResolvedValue(FEE)
    const confirm = await renderModal()

    await waitFor(() => {
      expect(confirm).toBeEnabled()
    })
    expect(screen.getByText(/Ark fee/u)).toBeInTheDocument()
    expect(screen.queryByText('Could not estimate the fee.')).not.toBeInTheDocument()
  })

  it('reports a failed fee estimate and keeps the confirm button disabled', async () => {
    boardFeeSpy.mockRejectedValue(new Error('fee estimate failed'))
    const confirm = await renderModal()

    await expect(screen.findByText(/Could not estimate the fee\./u)).resolves.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(confirm).toBeDisabled()

    await userEvent.click(confirm)
    expect(boardAllSpy).not.toHaveBeenCalled()
    expect(boardAmountSpy).not.toHaveBeenCalled()
  })

  it('recovers the fee estimate when the retry link is clicked', async () => {
    boardFeeSpy.mockRejectedValueOnce(new Error('fee estimate failed'))
    boardFeeSpy.mockResolvedValue(FEE)
    const confirm = await renderModal()

    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }))

    await waitFor(() => {
      expect(confirm).toBeEnabled()
    })
    expect(screen.queryByText('Could not estimate the fee.')).not.toBeInTheDocument()
    expect(screen.getByText(/Ark fee/u)).toBeInTheDocument()
  })
})
