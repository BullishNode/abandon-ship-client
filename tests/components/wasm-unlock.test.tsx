import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DeviceUnlockResult } from '@/lib/backend/wasm'
import { renderWithProviders } from '../utils/render'

vi.mock(import('@/lib/backend/wasm'), () => ({
  InvalidPasswordError: class InvalidPasswordError extends Error {
    override name = 'InvalidPasswordError'
  },
  clearDeviceVault: vi.fn<() => Promise<void>>(),
  clearVault: vi.fn<() => void>(),
  eraseLockedWallet: vi.fn<() => Promise<void>>(),
  hasVault: vi.fn<() => boolean>(() => false),
  openVault: vi.fn<(password: string) => Promise<string>>(),
  saveDeviceVault: vi.fn<(mnemonic: string) => Promise<void>>(),
  saveVault: vi.fn<(mnemonic: string, password: string) => Promise<void>>(),
  tryDeviceUnlock: vi.fn<() => Promise<DeviceUnlockResult>>(),
  unlockWallet: vi.fn<(mnemonic: string) => Promise<void>>()
}))

const { default: WasmUnlock } = await import('../../src/components/wasm-unlock')
const { eraseLockedWallet, hasVault } = await import('@/lib/backend/wasm')
const { useAuthStore } = await import('@/stores/auth')
const { useWalletStore } = await import('@/stores/wallet')

const eraseLockedWalletMock = vi.mocked(eraseLockedWallet)
const hasVaultMock = vi.mocked(hasVault)

function eraseButton() {
  return screen.getByRole('button', { name: 'Erase wallet and start over' })
}

describe('WasmUnlock mnemonic gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hasVaultMock.mockReturnValue(false)
    eraseLockedWalletMock.mockResolvedValue()
    useAuthStore.setState({ authRequired: true, authed: false, deviceUnlockFailed: false })
    useWalletStore.setState({ wallet: null })
  })

  it('always offers the erase escape hatch on the mnemonic gate', () => {
    renderWithProviders(<WasmUnlock />)
    expect(eraseButton()).toBeEnabled()
  })

  it('erases only after the destructive dialog is confirmed', async () => {
    const user = userEvent.setup()
    renderWithProviders(<WasmUnlock />)

    await user.click(eraseButton())
    expect(screen.getByText(/any funds in it will be permanently lost/iu)).toBeInTheDocument()
    expect(eraseLockedWalletMock).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Erase wallet' }))
    await waitFor(() => {
      expect(eraseLockedWalletMock).toHaveBeenCalledOnce()
    })
  })

  it('does not erase when the dialog is cancelled', async () => {
    const user = userEvent.setup()
    renderWithProviders(<WasmUnlock />)

    await user.click(eraseButton())
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(eraseLockedWalletMock).not.toHaveBeenCalled()
    expect(screen.queryByText('Erase this wallet?')).not.toBeInTheDocument()
  })

  it('shows the erase hatch behind the forgot-password path too', async () => {
    hasVaultMock.mockReturnValue(true)
    const user = userEvent.setup()
    renderWithProviders(<WasmUnlock />)

    expect(
      screen.queryByRole('button', { name: 'Erase wallet and start over' })
    ).not.toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Forgot password? Use your recovery phrase' })
    )
    expect(eraseButton()).toBeEnabled()
  })
})
