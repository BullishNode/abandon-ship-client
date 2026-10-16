import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FallbackDestinationSettings } from '@/components/fallback-destination-settings'
import { onchainApi, walletApi } from '@/lib/barkd-client'
import { walletKeys } from '@/lib/query-keys'
import { createTestQueryClient, renderWithProviders } from '../utils/render'

const ADDRESS = 'synthetic-stored-native-address'

describe(FallbackDestinationSettings, () => {
  const destination = vi.spyOn(walletApi, 'fallbackDestination')
  const onchainAddress = vi.spyOn(onchainApi, 'onchainAddress')
  const arkAddress = vi.spyOn(walletApi, 'address')
  let queryClient = createTestQueryClient()
  beforeEach(() => {
    queryClient = createTestQueryClient()
    destination.mockReset()
    onchainAddress.mockReset()
    arkAddress.mockReset()
  })
  afterEach(() => { queryClient.clear() })

  it('shows loading without inventing an address', () => {
    destination.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<FallbackDestinationSettings />, { queryClient })
    expect(screen.getByRole('status')).toHaveTextContent('Loading the stored payout address')
    expect(screen.getByLabelText('Automatic payout address')).toHaveValue('')
    expect(onchainAddress).not.toHaveBeenCalled()
    expect(arkAddress).not.toHaveBeenCalled()
  })

  it('displays only the stored address in a read-only field', async () => {
    destination.mockResolvedValue(ADDRESS)
    renderWithProviders(<FallbackDestinationSettings />, { queryClient })
    await waitFor(() => { expect(screen.getByLabelText('Automatic payout address')).toHaveValue(ADDRESS) })
    expect(screen.getByLabelText('Automatic payout address')).toHaveAttribute('readonly')
    expect(screen.queryByRole('button')).toBeNull()
    expect(onchainAddress).not.toHaveBeenCalled()
    expect(arkAddress).not.toHaveBeenCalled()
  })

  it('surfaces an unavailable stored address and retries only its query', async () => {
    destination.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce(ADDRESS)
    renderWithProviders(<FallbackDestinationSettings />, { queryClient })
    await screen.findByText('The stored payout address is unavailable.')
    expect(screen.getByLabelText('Automatic payout address')).toHaveValue('')
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }))
    await waitFor(() => { expect(screen.getByLabelText('Automatic payout address')).toHaveValue(ADDRESS) })
    expect(destination).toHaveBeenCalledTimes(2)
    expect(onchainAddress).not.toHaveBeenCalled()
    expect(arkAddress).not.toHaveBeenCalled()
  })

  it('hides a previously cached address after its current query fails', async () => {
    destination.mockResolvedValueOnce(ADDRESS).mockRejectedValueOnce(new Error('authentication lost'))
    renderWithProviders(<FallbackDestinationSettings />, { queryClient })
    await waitFor(() => { expect(screen.getByLabelText('Automatic payout address')).toHaveValue(ADDRESS) })
    await queryClient.invalidateQueries({ queryKey: walletKeys.fallbackDestination() })
    await screen.findByText('The stored payout address is unavailable.')
    expect(screen.getByLabelText('Automatic payout address')).toHaveValue('')
  })
})
