import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require_ = createRequire(import.meta.url)

const SCHEMA_FIELD_NAMES = [
  'base_fee_sat',
  'min_fee_sat',
  'ppm_expiry_table',
  'expiry_blocks_threshold',
  'fixed_additional_vb',
  'board',
  'offboard',
  'refresh',
  'lightning_receive',
  'lightning_send'
]

function readBindingsWasm(): string {
  const packageJson = require_.resolve('@secondts/bark/package.json')
  const root = packageJson.replace(/package\.json$/u, '')
  // The published package ships both targets; either carries the same strings.
  for (const target of ['web', 'bundler']) {
    try {
      return readFileSync(`${root}${target}/bark_ffi_wasm_bg.wasm`, 'latin1')
    } catch {
      // try the next target
    }
  }
  throw new Error('Could not locate bark_ffi_wasm_bg.wasm in @secondts/bark')
}

describe('feeScheduleJson bindings contract', () => {
  const wasm = readBindingsWasm()

  it.each(SCHEMA_FIELD_NAMES)('still emits the %s field', (field) => {
    expect(wasm).toContain(field)
  })

  // Guards the check itself: if the binary were unreadable or the search matched
  // everything, the assertions above would pass vacuously.
  it('does not match field names the bindings never emit', () => {
    expect(wasm).not.toContain('baseFeeSat')
    expect(wasm).not.toContain('ppmExpiryTable')
    expect(wasm).not.toContain('base_fee_sats')
  })
})
