import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SetupPasswordResult } from '@/types/auth'
import { renderWithProviders } from '../utils/render'

vi.mock(import('@/lib/auth-api'), async (importOriginal) => ({
  ...(await importOriginal()),
  setupPassword: vi.fn<(password: string) => Promise<SetupPasswordResult>>()
}))

const { AuthGate } = await import('../../src/components/auth-gate')
const { useAuthStore } = await import('../../src/stores/auth')

function renderGate() {
  renderWithProviders(
    <AuthGate>
      <div>APP</div>
    </AuthGate>
  )
}

describe('AuthGate', () => {
  beforeEach(() => {
    useAuthStore.setState({
      authRequired: true,
      authed: false,
      deviceUnlockFailed: false,
      passwordConfigured: true,
      tokenRejected: false,
      tokenRequired: false
    })
  })

  it('asks for the barkd token before anything else when one is required', () => {
    useAuthStore.setState({ authRequired: false, authed: true, tokenRequired: true })
    renderGate()
    expect(screen.getByText('Connect to barkd')).toBeInTheDocument()
    expect(screen.queryByText('APP')).not.toBeInTheDocument()
  })

  it('prefers the token prompt over the password gate', () => {
    useAuthStore.setState({ tokenRequired: true })
    renderGate()
    expect(screen.getByText('Connect to barkd')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Unlock' })).not.toBeInTheDocument()
  })

  it('renders the app when no auth is required', () => {
    useAuthStore.setState({ authRequired: false, authed: true })
    renderGate()
    expect(screen.getByText('APP')).toBeInTheDocument()
  })

  it('asks for the existing password when one is configured', () => {
    renderGate()
    expect(screen.getByRole('button', { name: 'Unlock' })).toBeInTheDocument()
  })

  it('offers first-run setup when the server has no password yet', () => {
    useAuthStore.setState({ passwordConfigured: false })
    renderGate()
    expect(screen.getByText('Protect Bark Wallet')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Unlock' })).not.toBeInTheDocument()
  })
})
