import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'
import { getMovementDefaultLabel, getOnchainDefaultLabel } from '../../src/utils/movement-labels'
import { createMovement } from '../fixtures/movements'

// oxlint-disable-next-line typescript/no-unsafe-type-assertion
const t = ((key: string) => key) as unknown as TFunction

describe(getMovementDefaultLabel, () => {
  it('returns the refresh label for refresh movements', () => {
    const { subsystem } = createMovement({ subsystem: { kind: 'refresh', name: 'Ark' } })
    expect(getMovementDefaultLabel(subsystem, t)).toBe('movements.kinds.refresh')
  })

  it('returns the exit label for bark.exit movements', () => {
    const { subsystem } = createMovement({ subsystem: { kind: 'exit', name: 'bark.exit' } })
    expect(getMovementDefaultLabel(subsystem, t)).toBe('movements.kinds.exit')
  })

  it('returns an empty string for other movements', () => {
    const { subsystem } = createMovement({ subsystem: { kind: 'ark', name: 'Ark' } })
    expect(getMovementDefaultLabel(subsystem, t)).toBe('')
  })
})

describe(getOnchainDefaultLabel, () => {
  it('returns the exit fee label for cpfp transactions', () => {
    expect(getOnchainDefaultLabel(true, t)).toBe('movements.onchain.exit_fee_label')
  })

  it('returns an empty string for non-cpfp transactions', () => {
    expect(getOnchainDefaultLabel(false, t)).toBe('')
  })
})
