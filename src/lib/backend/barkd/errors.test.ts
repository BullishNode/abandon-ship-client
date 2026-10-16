import { ResponseError } from '@secondts/barkd'
import { describe, expect, it } from 'vitest'
import { barkdErrorMessage } from '@/lib/backend/barkd/errors'

function refusal(code: string, message: string) {
  return new ResponseError(Response.json({ code, message }, { status: 409 }), 'Request failed')
}

describe('typed native fallback refusals', () => {
  it('selects the fixed user explanation by code when server diagnostics change', async () => {
    await expect(
      barkdErrorMessage(refusal('decided_for_fallback', 'private diagnostic'))
    ).resolves.toBe('This coin expired and is being paid to your fallback address.')
    await expect(
      barkdErrorMessage(refusal('expired_new_lightning', 'different diagnostic'))
    ).resolves.toBe('This coin expired. Refresh it first, then send.')
  })

  it('does not infer a typed refusal from text', async () => {
    await expect(
      barkdErrorMessage(refusal('future_reason', 'A distinct server error'))
    ).resolves.toBe('A distinct server error')
    await expect(barkdErrorMessage(new Error('Connection refused'))).resolves.toBe(
      'Connection refused'
    )
  })
})
