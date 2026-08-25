import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RedirectRoute } from '@/components/redirect-route'
import { walletApi } from '@/lib/barkd-client'
import type { WalletExists } from '@/types/domain/wallet'

vi.mock(import('@/lib/barkd-client'), async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    walletApi: {
      ...actual.walletApi,
      walletExists: vi.fn<() => Promise<WalletExists>>()
    }
  }
})

const walletExistsMock = vi.mocked(walletApi.walletExists)

function renderAt(path: string) {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<RedirectRoute />}>
            <Route element={<div>welcome page</div>} path="/" />
            <Route element={<div>create page</div>} path="/create" />
            <Route element={<div>import page</div>} path="/import" />
            <Route element={<div>dashboard page</div>} path="/dashboard" />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe(RedirectRoute, () => {
  beforeEach(() => {
    walletExistsMock.mockReset()
  })

  it.each(['/create', '/import'])(
    'shows the error state instead of onboarding at %s when the wallet check fails',
    async (path) => {
      walletExistsMock.mockRejectedValue(new Error('barkd unreachable'))
      renderAt(path)
      await expect(
        screen.findByText('Could not check your wallet status')
      ).resolves.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
      expect(screen.queryByText('create page')).not.toBeInTheDocument()
      expect(screen.queryByText('import page')).not.toBeInTheDocument()
    }
  )

  it('retries the wallet check and redirects to the dashboard when a wallet exists', async () => {
    walletExistsMock
      .mockRejectedValueOnce(new Error('barkd unreachable'))
      .mockResolvedValueOnce({ fingerprint: 'abc123' })
    renderAt('/create')
    const retryButton = await screen.findByRole('button', { name: 'Try again' })
    await userEvent.click(retryButton)
    await expect(screen.findByText('dashboard page')).resolves.toBeInTheDocument()
    expect(screen.queryByText('create page')).not.toBeInTheDocument()
  })

  it('renders onboarding when the wallet check confirms no wallet exists', async () => {
    walletExistsMock.mockResolvedValue({ fingerprint: null })
    renderAt('/create')
    await expect(screen.findByText('create page')).resolves.toBeInTheDocument()
  })
})
