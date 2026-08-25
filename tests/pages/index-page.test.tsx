import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import IndexPage from '../../src/pages/index'
import { renderWithProviders } from '../utils/render'

describe(IndexPage, () => {
  it('offers both onboarding paths and creates nothing on its own', () => {
    renderWithProviders(<IndexPage />)

    expect(screen.getByRole('link', { name: 'Create new wallet' })).toHaveAttribute(
      'href',
      '/create'
    )
    expect(screen.getByRole('link', { name: 'Import existing wallet' })).toHaveAttribute(
      'href',
      '/import'
    )
  })
})
