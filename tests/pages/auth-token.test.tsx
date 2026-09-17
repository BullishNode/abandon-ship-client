import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConnectAuthTokenResult } from '@/types/auth'
import { renderWithProviders } from '../utils/render'

const connectAuthToken = vi.fn<(token: string) => Promise<ConnectAuthTokenResult>>()

vi.mock(import('@/lib/backend/barkd/auth-token'), async (importOriginal) => ({
  ...(await importOriginal()),
  connectAuthToken
}))

const { default: AuthTokenPage } = await import('../../src/pages/auth-token')
const { useAuthStore } = await import('../../src/stores/auth')

const TOKEN = 'AKoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKio'
const reload = vi.fn<() => void>()

function submitButton() {
  return screen.getByRole('button', { name: 'Connect' })
}

async function fill(user: ReturnType<typeof userEvent.setup>, token: string) {
  renderWithProviders(<AuthTokenPage />)
  await user.type(screen.getByLabelText('Auth token'), token)
}

describe('AuthTokenPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    connectAuthToken.mockResolvedValue({ ok: true })
    useAuthStore.setState({ tokenRejected: false, tokenRequired: true })
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { reload },
      writable: true
    })
  })

  it('tells the user where to find the token', () => {
    renderWithProviders(<AuthTokenPage />)
    expect(screen.getByText('Connect to barkd')).toBeInTheDocument()
    expect(screen.getByText('barkd secret show')).toBeInTheDocument()
    expect(screen.getByText('<datadir>/auth_token')).toBeInTheDocument()
    expect(submitButton()).toBeDisabled()
  })

  it('explains when a previously saved token stopped working', () => {
    useAuthStore.setState({ tokenRejected: true })
    renderWithProviders(<AuthTokenPage />)
    expect(screen.getByText(/saved token was rejected/u)).toBeInTheDocument()
  })

  it('refuses a malformed token without contacting barkd', async () => {
    const user = userEvent.setup()
    await fill(user, 'not a token')
    await user.click(submitButton())

    expect(screen.getByText('That does not look like a barkd auth token.')).toBeInTheDocument()
    expect(connectAuthToken).not.toHaveBeenCalled()
  })

  it('connects with the trimmed token and reloads', async () => {
    const user = userEvent.setup()
    await fill(user, `  ${TOKEN}  `)
    await user.click(submitButton())

    await waitFor(() => expect(connectAuthToken.mock.calls[0]?.[0]).toBe(TOKEN))
    await waitFor(() => expect(reload).toHaveBeenCalledOnce())
  })

  it('shows the rejection and stays put when barkd refuses the token', async () => {
    connectAuthToken.mockResolvedValue({ ok: false, reason: 'invalid' })
    const user = userEvent.setup()
    await fill(user, TOKEN)
    await user.click(submitButton())

    await expect(screen.findByText(/barkd rejected this token/u)).resolves.toBeInTheDocument()
    expect(reload).not.toHaveBeenCalled()
  })
})
