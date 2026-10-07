import { fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { BrantaVerificationStatus } from '../../src/components/branta-verification-status'
import { useSettingsStore } from '../../src/stores/settings'
import { renderWithProviders } from '../utils/render'

const DARK_LOGO = 'https://guardrail.branta.pro/rails/active_storage/blobs/redirect/dark.png'
const LIGHT_LOGO = 'https://guardrail.branta.pro/rails/active_storage/blobs/redirect/light.png'
const VERIFY_URL = 'https://guardrail.branta.pro/v2/verify/abc'

const PAYMENT = {
  destinations: [],
  platform: 'Arotags',
  platformLogoLightUrl: LIGHT_LOGO,
  platformLogoUrl: DARK_LOGO
}

function getLogo(container: HTMLElement) {
  const logo = container.querySelector('img')
  if (logo === null) {
    throw new Error('expected a logo')
  }
  return logo
}

describe(BrantaVerificationStatus, () => {
  afterEach(() => {
    useSettingsStore.setState({ theme: 'system' })
  })

  it('falls back to the next logo when one fails to load', () => {
    useSettingsStore.setState({ theme: 'light' })
    const { container } = renderWithProviders(
      <BrantaVerificationStatus payment={PAYMENT} verifyUrl={VERIFY_URL} />
    )
    fireEvent.error(getLogo(container))

    expect(getLogo(container)).toHaveAttribute('src', DARK_LOGO)
  })

  it('drops the logo and its skeleton when every logo fails to load', () => {
    useSettingsStore.setState({ theme: 'dark' })
    const { container } = renderWithProviders(
      <BrantaVerificationStatus payment={PAYMENT} verifyUrl={VERIFY_URL} />
    )
    fireEvent.error(getLogo(container))

    expect(container.querySelector('img')).not.toBeInTheDocument()
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Arotags' })).toBeInTheDocument()
  })
})
