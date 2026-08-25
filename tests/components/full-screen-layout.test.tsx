import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FullScreenLayout } from '../../src/components/full-screen-layout'
import { renderWithProviders } from '../utils/render'

const EXPECTED_LINKS = [
  ['Community chat', 'https://chat.second.tech'],
  ['Community forum', 'https://community.second.tech'],
  ['Terms of service', 'https://second.tech/terms']
] as const

describe(FullScreenLayout, () => {
  it.each(EXPECTED_LINKS)('links %s to %s in the footer', (name, href) => {
    renderWithProviders(
      <FullScreenLayout>
        <div>CONTENT</div>
      </FullScreenLayout>
    )

    const link = screen.getByRole('link', { name })
    expect(link).toHaveAttribute('href', href)
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })
})
