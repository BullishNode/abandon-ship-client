import logoSvg from '@/assets/bark-wallet-logo.svg?raw'

const ORIGINAL_LOGO_FILL = '#060606'
const DARK_LOGO_FILL = '#ffffff'

function buildLogoDataUri(fill: string): string {
  const svg = logoSvg.replaceAll(ORIGINAL_LOGO_FILL, fill)
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export const lightLogo = buildLogoDataUri(ORIGINAL_LOGO_FILL)
export const darkLogo = buildLogoDataUri(DARK_LOGO_FILL)
