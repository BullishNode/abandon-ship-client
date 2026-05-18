import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RedirectRoute } from '../../src/components/redirect-route'
import { createTestQueryClient } from '../utils/render'

vi.mock(import('@/lib/barkd-client'), async (importOriginal) => {
  const actual = await importOriginal()
  vi.spyOn(actual.walletApi, 'walletExists').mockReturnValue(Promise.race([]))
  return actual
})

const { walletApi } = await import('../../src/lib/barkd-client')

function renderAt(initialPath: string) {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route element={<RedirectRoute />}>
            <Route element={<div>WELCOME</div>} path="/" />
            <Route element={<div>CREATE</div>} path="/create" />
            <Route element={<div>IMPORT</div>} path="/import" />
            <Route element={<div>DASHBOARD</div>} path="/dashboard" />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe(RedirectRoute, () => {
  beforeEach(() => {
    vi.mocked(walletApi.walletExists).mockReset()
  })

  afterEach(() => {
    vi.mocked(walletApi.walletExists).mockReset()
  })

  it('shows the spinner while the wallet check is pending', () => {
    vi.mocked(walletApi.walletExists).mockReturnValue(Promise.race([]))
    renderAt('/')
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })

  it('renders onboarding outlet at /create regardless of wallet state', async () => {
    vi.mocked(walletApi.walletExists).mockResolvedValue({ fingerprint: 'abc' })
    renderAt('/create')
    await expect(screen.findByText('CREATE')).resolves.toBeInTheDocument()
  })

  it('renders onboarding outlet at /import regardless of wallet state', async () => {
    vi.mocked(walletApi.walletExists).mockResolvedValue({ fingerprint: '' })
    renderAt('/import')
    await expect(screen.findByText('IMPORT')).resolves.toBeInTheDocument()
  })

  it('redirects to /dashboard when a wallet exists and path is /', async () => {
    vi.mocked(walletApi.walletExists).mockResolvedValue({ fingerprint: 'abc' })
    renderAt('/')
    await waitFor(() => expect(screen.getByText('DASHBOARD')).toBeInTheDocument())
  })

  it('redirects to / when no wallet and path is /dashboard', async () => {
    vi.mocked(walletApi.walletExists).mockResolvedValue({ fingerprint: '' })
    renderAt('/dashboard')
    await waitFor(() => expect(screen.getByText('WELCOME')).toBeInTheDocument())
  })

  it('renders the welcome outlet when no wallet at /', async () => {
    vi.mocked(walletApi.walletExists).mockResolvedValue({ fingerprint: '' })
    renderAt('/')
    await expect(screen.findByText('WELCOME')).resolves.toBeInTheDocument()
  })
})
