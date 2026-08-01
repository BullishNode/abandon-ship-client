import type { ChainSourceConfig } from '@secondts/barkd'
import { z } from 'zod'

// Sentinel message so the field can tell "missing" from "malformed" and pick
// the matching i18n key. Never rendered.
export const BIRTHDAY_HEIGHT_REQUIRED = 'birthday_height_required'

// `Number('') === 0` and `.optional()` only short-circuits on an absent key, so
// the blank string an untouched input yields has to be mapped to `undefined`.
// Whitespace counts as blank: the field is typed text, so a stray space would
// otherwise fail validation on an input that looks empty.
export const birthdayHeightSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.coerce.number().int().positive().optional()
)

// barkd rejects a mnemonic-carrying create with no birthday height against a
// bitcoind chain source — "You need to set the --birthday-height field when
// recovering from mnemonic." (bark 0.4.0, `try_create_wallet`). The check runs
// before the node is contacted, so a blank field is a 500 the user cannot act
// on. Esplora ignores the value server-side, so it stays optional there.
export function requiresBirthdayHeight(chainSource: ChainSourceConfig): boolean {
  return 'bitcoind' in chainSource
}

// The chain source is read through a getter: this schema is built at module
// scope, before `initConfig()` has populated the runtime config, while the
// refinement only runs at parse time.
export function birthdayHeightSchemaFor(getChainSource: () => ChainSourceConfig) {
  return birthdayHeightSchema.superRefine((value, ctx) => {
    if (value === undefined && requiresBirthdayHeight(getChainSource())) {
      ctx.addIssue({ code: 'custom', message: BIRTHDAY_HEIGHT_REQUIRED })
    }
  })
}
