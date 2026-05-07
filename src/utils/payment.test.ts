import type { Destination } from 'bitcoin-decoder'
import { decode } from 'bitcoin-decoder'
import { describe, expect, it, vi } from 'vitest'
import { getSendRoute, parsePaymentInput } from './payment'

vi.mock(import('bitcoin-decoder'), () => ({
  decode: vi.fn<typeof decode>()
}))

function makeDestination(type: Destination['type'], destination: string): Destination {
  if (type === 'bitcoin-address') {
    return { addressType: 'p2wpkh', destination, protocol: 'on-chain', type }
  }
  return { destination, protocol: 'lightning', type } as Destination
}

const arkDest = makeDestination('ark-address', 'ark1abc')
const bolt11Dest = makeDestination('bolt11', 'lnbc1abc')
const btcDest = makeDestination('bitcoin-address', 'bc1qabc')

describe(getSendRoute, () => {
  it('returns ark for ark-address', () => {
    expect(getSendRoute('ark-address')).toBe('ark')
  })

  it('returns lightning for bolt11', () => {
    expect(getSendRoute('bolt11')).toBe('lightning')
  })

  it('returns lightning for bolt12', () => {
    expect(getSendRoute('bolt12')).toBe('lightning')
  })

  it('returns lightning for lnaddress', () => {
    expect(getSendRoute('lnaddress')).toBe('lightning')
  })

  it('returns lightning for lnurl', () => {
    expect(getSendRoute('lnurl')).toBe('lightning')
  })

  it('returns onchain-from-ark for bitcoin-address', () => {
    expect(getSendRoute('bitcoin-address')).toBe('onchain-from-ark')
  })
})

describe(parsePaymentInput, () => {
  const mockDecode = vi.mocked(decode)

  it('passes trimmed input to decode', async () => {
    mockDecode.mockResolvedValue({
      destination: bolt11Dest,
      destinations: [bolt11Dest],
      input: 'lnbc1abc',
      network: 'mainnet',
      valid: true
    })

    await parsePaymentInput('  lnbc1abc  ')
    expect(mockDecode).toHaveBeenCalledWith('lnbc1abc')
  })

  it('returns decoded result as-is', async () => {
    const decoded = {
      destination: arkDest,
      destinations: [arkDest, btcDest],
      input: 'bitcoin:bc1qabc?ark=ark1abc',
      metadata: { amount: 50_000, description: 'test' },
      network: 'mainnet' as const,
      valid: true as const
    }
    mockDecode.mockResolvedValue(decoded)

    const result = await parsePaymentInput('bitcoin:bc1qabc?ark=ark1abc')
    expect(result).toStrictEqual(decoded)
  })

  it('returns error result when decode fails', async () => {
    const error = {
      errorCode: 'UNKNOWN_FORMAT' as const,
      errorMessage: 'Unknown input',
      input: 'garbage',
      valid: false as const
    }
    mockDecode.mockResolvedValue(error)

    const result = await parsePaymentInput('garbage')
    expect(result).toStrictEqual(error)
  })
})
