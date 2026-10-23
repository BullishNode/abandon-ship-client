import type { Payment } from '@branta-ops/branta/v2'
import type { ResolvedTheme } from '@/types/theme'

type BrantaLogoSource = Pick<Payment, 'platformLogoUrl' | 'platformLogoLightUrl'>

function isFromOrigin(value: string | undefined, origin: string): value is string {
  if (value === undefined) {
    return false
  }
  try {
    return new URL(value).origin === origin
  } catch {
    return false
  }
}

/**
 * Per Branta's guidance, `platformLogoUrl` is for dark backgrounds and
 * `platformLogoLightUrl` for light ones. Deduplicated so a failed image
 * never retries the same `src` (which would fire no new load/error event).
 */
export function getBrantaLogoUrls(
  payment: BrantaLogoSource,
  theme: ResolvedTheme,
  trustedOrigin: string
): string[] {
  const candidates =
    theme === 'dark'
      ? [payment.platformLogoUrl]
      : [payment.platformLogoLightUrl, payment.platformLogoUrl]
  const trusted = candidates.filter((url) => isFromOrigin(url, trustedOrigin))
  return [...new Set(trusted)]
}
