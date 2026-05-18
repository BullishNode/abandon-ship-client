import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from '../../src/components/confirm-dialog'
import { renderWithProviders } from '../utils/render'

type ConfirmFn = () => void
type OpenChangeFn = (open: boolean) => void

describe(ConfirmDialog, () => {
  it('renders the title and description when provided', () => {
    renderWithProviders(
      <ConfirmDialog
        description="This cannot be undone"
        onConfirm={vi.fn<ConfirmFn>()}
        onOpenChange={vi.fn<OpenChangeFn>()}
        open
        title="Delete wallet"
      />
    )
    expect(screen.getByText('Delete wallet')).toBeInTheDocument()
    expect(screen.getByText('This cannot be undone')).toBeInTheDocument()
  })

  it('uses default cancel/confirm labels from i18n', () => {
    renderWithProviders(
      <ConfirmDialog
        onConfirm={vi.fn<ConfirmFn>()}
        onOpenChange={vi.fn<OpenChangeFn>()}
        open
        title="Title"
      />
    )
    expect(screen.getByRole('button', { name: /cancel/iu })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /confirm/iu })).toBeInTheDocument()
  })

  it('calls onConfirm when the confirm button is clicked', async () => {
    const onConfirm = vi.fn<ConfirmFn>()
    renderWithProviders(
      <ConfirmDialog
        confirmLabel="Yes"
        onConfirm={onConfirm}
        onOpenChange={vi.fn<OpenChangeFn>()}
        open
        title="Title"
      />
    )
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('calls onOpenChange(false) when cancel is clicked', async () => {
    const onOpenChange = vi.fn<OpenChangeFn>()
    renderWithProviders(
      <ConfirmDialog
        cancelLabel="No"
        onConfirm={vi.fn<ConfirmFn>()}
        onOpenChange={onOpenChange}
        open
        title="Title"
      />
    )
    await userEvent.click(screen.getByRole('button', { name: 'No' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('disables cancel and ignores its click while loading', async () => {
    const onOpenChange = vi.fn<OpenChangeFn>()
    renderWithProviders(
      <ConfirmDialog
        cancelLabel="No"
        loading
        onConfirm={vi.fn<ConfirmFn>()}
        onOpenChange={onOpenChange}
        open
        title="Title"
      />
    )
    const cancel = screen.getByRole('button', { name: 'No' })
    expect(cancel).toBeDisabled()
    await userEvent.click(cancel)
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})
