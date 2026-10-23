import { describe, expect, it } from 'vitest'
import { getBrantaLogoUrls } from '../../src/utils/branta'

const ORIGIN = 'https://guardrail.branta.pro'
const DARK_LOGO = `${ORIGIN}/rails/active_storage/blobs/redirect/dark.png`
const LIGHT_LOGO = `${ORIGIN}/rails/active_storage/blobs/redirect/light.png`
const PAYMENT = { platformLogoLightUrl: LIGHT_LOGO, platformLogoUrl: DARK_LOGO }

describe(getBrantaLogoUrls, () => {
  it('uses only the default logo on a dark background', () => {
    expect(getBrantaLogoUrls(PAYMENT, 'dark', ORIGIN)).toStrictEqual([DARK_LOGO])
  })

  it('prefers the light logo on a light background, then the default', () => {
    expect(getBrantaLogoUrls(PAYMENT, 'light', ORIGIN)).toStrictEqual([LIGHT_LOGO, DARK_LOGO])
  })

  it('drops logos hosted outside the Branta origin', () => {
    const payment = { ...PAYMENT, platformLogoLightUrl: 'https://cdn.example.com/logo.png' }
    expect(getBrantaLogoUrls(payment, 'light', ORIGIN)).toStrictEqual([DARK_LOGO])
  })

  it('lists a logo once when both variants are the same URL', () => {
    const payment = { platformLogoLightUrl: DARK_LOGO, platformLogoUrl: DARK_LOGO }
    expect(getBrantaLogoUrls(payment, 'light', ORIGIN)).toStrictEqual([DARK_LOGO])
  })
})
