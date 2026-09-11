import type { PrivacyMode } from '@branta-ops/branta'

/**
 * How the wallet verifies send destinations against Branta.
 *
 * - `strict`: only encrypted (zero-knowledge) lookups; the raw destination
 *   never leaves the device, but merchants that registered plain-text
 *   destinations will not verify.
 * - `loose`: falls back to plain-text lookups, so more merchants verify at the
 *   cost of sending the destination to Branta.
 * - `off`: never contacts Branta.
 */
export type BrantaMode = PrivacyMode | 'off'

export const BRANTA_MODES = ['strict', 'loose', 'off'] as const satisfies readonly BrantaMode[]
