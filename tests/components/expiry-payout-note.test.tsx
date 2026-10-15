import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ExpiryPayoutNote } from '@/components/expiry-payout-note'

const state = vi.hoisted(() => ({ unavailable: false, retry: vi.fn<() => void>() }))
vi.mock(import('@/hooks/barkd/use-expired-vtxos'), () => ({
  useExpiredVtxos: () => ({
    excludedIds: new Set<string>(), isChecked: !state.unavailable,
    isStatusError: state.unavailable, retryStatus: state.retry
  })
}))

describe(ExpiryPayoutNote, () => {
  beforeEach(() => { state.unavailable = false; state.retry.mockReset() })
  it('does not offer a second principal sweep when the status is available', () => {
    render(<ExpiryPayoutNote />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })
  it('shows unavailable status and only retries the status query', () => {
    state.unavailable = true
    render(<ExpiryPayoutNote />)
    expect(screen.getByRole('status')).toHaveTextContent('Expired coin status is unavailable')
    expect(screen.getByRole('status')).toHaveTextContent('does not by itself confirm a Bitcoin payment')
    expect(screen.getAllByRole('button')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }))
    expect(state.retry).toHaveBeenCalledOnce()
  })
})
