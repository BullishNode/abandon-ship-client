import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ExpiryPayoutNote } from '@/components/expiry-payout-note'
import { onchainApi } from '@/lib/barkd-client'
import { useSettingsStore } from '@/stores/settings'
import type { ExpiryPayoutSweep } from '@/types/domain/expiry-payout'

const state = vi.hoisted(() => ({
  isPayoutError: false,
  refresh: vi.fn<() => void>()
}))
vi.mock(import('@/hooks/barkd/use-expired-vtxos'), () => ({
  useExpiredVtxos: () => ({
    excludedIds: new Set<string>(),
    isChecked: true,
    isPayoutError: state.isPayoutError,
    payingOutIds: new Set<string>(),
    payingOutSat: 9500,
    payoutById: new Map(),
    payouts: [{ amountSats: 9500, txid: 'payout', vout: 0, vtxoId: 'coin:0' }],
    refreshPayouts: state.refresh
  })
}))
vi.mock(import('@/hooks/use-format-fiat'), () => ({ useFormatFiat: () => () => '' }))

describe(ExpiryPayoutNote, () => {
  let queryClient: QueryClient
  const sweep = vi.spyOn(onchainApi, 'sweepExpiryPayouts')
  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    state.isPayoutError = false
    state.refresh.mockReset()
    sweep.mockReset()
    useSettingsStore.setState({ bitcoinUnit: 'sats', discreetMode: false })
  })
  afterEach(() => {
    queryClient.clear()
  })
  function renderNote() {
    return render(<ExpiryPayoutNote />, {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      )
    })
  }

  it('hides the payout amount with the wallet privacy setting', () => {
    useSettingsStore.setState({ discreetMode: true })
    renderNote()
    expect(screen.getByRole('status').textContent?.replaceAll(/\s/gu, '')).not.toContain('9500')
    expect(screen.getByRole('button', { name: 'Move to on-chain balance' })).toBeEnabled()
  })

  it('lets the user retry a stale lookup without sending a transaction', () => {
    state.isPayoutError = true
    renderNote()
    expect(screen.getByText(/last checked amount/u)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Move to on-chain balance' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }))
    expect(state.refresh).toHaveBeenCalledOnce()
    expect(sweep).not.toHaveBeenCalled()
  })

  it('names the pending action and prevents another submission', async () => {
    let complete: ((result: ExpiryPayoutSweep) => void) | undefined
    // Keep the real mutation pending while asserting the disabled control.
    // oxlint-disable-next-line promise/avoid-new
    const pending = new Promise<ExpiryPayoutSweep>((resolve) => {
      complete = resolve
    })
    sweep.mockReturnValue(pending)
    renderNote()
    fireEvent.click(screen.getByRole('button', { name: 'Move to on-chain balance' }))
    const button = await screen.findByRole('button', { name: 'Moving payout…' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(button)
    expect(sweep).toHaveBeenCalledOnce()
    await act(async () => {
      complete?.({ sweptSats: 9300, txid: 'sweep' })
      await pending
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Move to on-chain balance' })).toBeEnabled()
    })
  })
})
