import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MovementAmountCell } from '@/components/movement-amount-cell'

function formatSats(sats: number): string {
  return `${sats} sats`
}

function formatFiat(sats: number): string {
  return `$${sats}`
}

function renderCell(sats: number, discreetMode = false): void {
  render(
    <MovementAmountCell
      discreetMode={discreetMode}
      formatFiat={formatFiat}
      formatSats={formatSats}
      sats={sats}
    />
  )
}

describe(MovementAmountCell, () => {
  it('renders a positive amount with a plus sign in green', () => {
    renderCell(500)
    const amount = screen.getByText('+500 sats')
    expect(amount).toHaveClass('text-green-500')
  })

  it('renders a negative amount without a sign and not green', () => {
    renderCell(-1)
    const amount = screen.getByText('-1 sats')
    expect(amount).not.toHaveClass('text-green-500')
  })

  it('renders zero without a plus sign and not green', () => {
    renderCell(0)
    const amount = screen.getByText('0 sats')
    expect(amount).not.toHaveClass('text-green-500')
    expect(screen.queryByText('+0 sats')).toBeNull()
  })

  it('omits the sign entirely in discreet mode', () => {
    renderCell(500, true)
    expect(screen.getByText('500 sats')).toHaveClass('text-foreground')
  })
})
