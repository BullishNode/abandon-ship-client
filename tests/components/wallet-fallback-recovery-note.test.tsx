import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { address, networks, Transaction } from 'bitcoinjs-lib'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18next from 'i18next'
import { DataTable } from '@/components/data-table'
import { getVtxoColumns } from '@/components/vtxos/vtxos-columns'
import { WalletFallbackRecoveryNote } from '@/components/wallet-fallback-recovery-note'
import { walletFallbackApi } from '@/lib/backend/barkd/wallet-fallback'

const recovery = vi.hoisted(() => ({ ids: ['old:0'], checked: true, hasExpiredCoins: true }))
vi.mock('@/hooks/barkd/use-expired-vtxos', () => ({
  useExpiredVtxos: () => ({ recoveryUnknownIds: new Set(recovery.ids), isChecked: recovery.checked, hasExpiredCoins: recovery.hasExpiredCoins })
}))
vi.mock('@/hooks/barkd/use-bitcoin-tip', () => ({ useBitcoinTip: () => ({ data: 100 }) }))
const data = vi.hoisted(() => ({ transactions: [] as unknown[] | undefined }))
vi.mock('@/hooks/barkd/use-onchain-transactions', () => ({ useOnchainTransactions: () => ({ data: data.transactions }) }))
const destination = address.toBech32(new Uint8Array(20).fill(1), 0, 'tb')

describe(WalletFallbackRecoveryNote, () => {
  let client: QueryClient
  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    data.transactions = []
    recovery.ids = ['old:0']; recovery.checked = true; recovery.hasExpiredCoins = true
    vi.spyOn(walletFallbackApi, 'destination').mockResolvedValue({ address: destination, seq: 3 })
    vi.spyOn(walletFallbackApi, 'sync').mockResolvedValue(undefined)
  })
  afterEach(() => { client.clear(); vi.restoreAllMocks() })
  function show() {
    render(<QueryClientProvider client={client}><WalletFallbackRecoveryNote /></QueryClientProvider>)
  }
  it('keeps original recovery uncertainty visible without an unsupported sweep action', async () => {
    show()
    await waitFor(() => expect(walletFallbackApi.destination).toHaveBeenCalled())
    expect(screen.getByText(/server marked 1 expired coin spent/u)).toBeInTheDocument()
    expect(screen.getByText(/not every address used previously/u)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sweep|move to/iu })).not.toBeInTheDocument()
  })
  it('does not call a coincidentally matching receipt a server payout or clear the original id', async () => {
    const tx = new Transaction()
    tx.addInput(new Uint8Array(32).fill(3), 0)
    tx.addOutput(address.toOutputScript(destination, networks.testnet), 1000n)
    data.transactions = [{ txid: tx.getId(), tx: tx.toHex(), balanceChangeSats: 1000, isCpfp: false,
      confirmation: { height: 90, hash: 'ab'.repeat(32) } }]
    show()
    await screen.findByText(/Confirmed receipts at the current recovery address/u)
    expect(screen.getByText(/receipt alone does not establish that the server paid/u)).toBeInTheDocument()
    expect(screen.getByText(/recovery has not been independently attributed/u)).toBeInTheDocument()
  })
  it('preserves unknown recovery when the destination is unavailable', async () => {
    vi.mocked(walletFallbackApi.destination).mockRejectedValue(new Error('unavailable'))
    show()
    await screen.findByText(/Some recovery details are unavailable/u)
    expect(screen.getByText(/server marked 1 expired coin spent/u)).toBeInTheDocument()
  })
  it('keeps known recovery visible while transaction details are missing', async () => {
    data.transactions = undefined
    show()
    expect(await screen.findByText(/Some recovery details are unavailable/u)).toBeInTheDocument()
    expect(screen.getByText(/server marked 1 expired coin spent/u)).toBeInTheDocument()
  })
  it('keeps known recovery visible when raw transaction details are invalid', async () => {
    data.transactions = [{ txid: 'ff'.repeat(32), tx: 'invalid', balanceChangeSats: 1000, isCpfp: false }]
    show()
    await waitFor(() => expect(walletFallbackApi.destination).toHaveBeenCalled())
    expect(await screen.findByText(/Some recovery details are unavailable/u)).toBeInTheDocument()
    expect(screen.getByText(/server marked 1 expired coin spent/u)).toBeInTheDocument()
  })
  it('does not show a recovery warning for a normal wallet with no expired work', async () => {
    recovery.ids = []; recovery.hasExpiredCoins = false
    vi.mocked(walletFallbackApi.destination).mockRejectedValue(new Error('unavailable'))
    show()
    await waitFor(() => expect(walletFallbackApi.destination).toHaveBeenCalled())
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
  it('renders the unverified badge through the actual table column and badge components', () => {
    const columns = getVtxoColumns({
      t: i18next.t, locale: 'en', formatSats: String, formatFiat: String, tipHeight: 100,
      exitPhaseById: new Map(), exitStateById: new Map(), lockLabelById: new Map(), refreshPhaseById: new Map(),
      payoutState: { payingOutIds: new Set(), payoutById: new Map(), recoveryUnknownIds: new Set(['old:0']) }
    })
    render(<DataTable columns={columns} data={[{ id: 'old:0', amountSats: 1000, expiryHeight: 90, state: { type: 'spent' as const } }]} />)
    expect(screen.getByText('Recovery unverified')).toBeInTheDocument()
    expect(screen.queryByText('Paid out')).not.toBeInTheDocument()
  })
  it('runs the real complete refresh adapter only on explicit request', async () => {
    show()
    expect(walletFallbackApi.sync).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh wallet' }))
    await waitFor(() => expect(walletFallbackApi.sync).toHaveBeenCalledTimes(1))
    expect(screen.getByText(/recovery has not been independently attributed/u)).toBeInTheDocument()
  })
})
