import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SetupPasswordResult } from '@/types/auth'
import { renderWithProviders } from '../utils/render'

const setupPassword = vi.fn<(password: string) => Promise<SetupPasswordResult>>()

vi.mock(import('@/lib/auth-api'), async (importOriginal) => ({
  ...(await importOriginal()),
  setupPassword
}))

const { default: SetupPasswordPage } = await import('../../src/pages/setup-password')

const reload = vi.fn<() => void>()

function submitButton() {
  return screen.getByRole('button', { name: 'Continue' })
}

async function fill(user: ReturnType<typeof userEvent.setup>, password: string, confirm: string) {
  renderWithProviders(<SetupPasswordPage />)
  await user.type(screen.getByLabelText('Password'), password)
  await user.type(screen.getByLabelText('Confirm password'), confirm)
}

describe('SetupPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupPassword.mockResolvedValue({ ok: true })
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { reload },
      writable: true
    })
  })

  it('refuses a password shorter than the minimum', async () => {
    const user = userEvent.setup()
    await fill(user, 'short12', 'short12')

    expect(submitButton()).toBeDisabled()
    expect(setupPassword).not.toHaveBeenCalled()
  })

  it('refuses a mismatched confirmation', async () => {
    const user = userEvent.setup()
    await fill(user, 'longenough', 'longenoug')

    expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
    expect(submitButton()).toBeDisabled()
  })

  it('sets the password and reloads so the session is picked up', async () => {
    const user = userEvent.setup()
    await fill(user, 'longenough', 'longenough')
    await user.click(submitButton())

    // react-query hands the mutation context as a second argument, so only the
    // first one is asserted here.
    await waitFor(() => expect(setupPassword.mock.calls[0]?.[0]).toBe('longenough'))
    await waitFor(() => expect(reload).toHaveBeenCalledOnce())
  })

  it('surfaces a server-side rejection without reloading', async () => {
    setupPassword.mockResolvedValue({ ok: false, reason: 'already_configured' })
    const user = userEvent.setup()
    await fill(user, 'longenough', 'longenough')
    await user.click(submitButton())

    await expect(
      screen.findByText('A password is already set. Reload the page to sign in.')
    ).resolves.toBeInTheDocument()
    expect(reload).not.toHaveBeenCalled()
  })
})
