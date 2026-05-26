import type { Destination } from 'bitcoin-decoder'
import { decode } from 'bitcoin-decoder'
import { describe, expect, it, vi } from 'vitest'
import { getSendRoute, parsePaymentInput, pickCheapestDestination } from './payment'

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
      kind: 'payment',
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
      kind: 'payment' as const,
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

describe(pickCheapestDestination, () => {
  const bolt12Dest = makeDestination('bolt12', 'lno1abc')
  const lnaddressDest = makeDestination('lnaddress', 'foo@bar.com')
  const lnurlDest = makeDestination('lnurl', 'lnurl1abc')

  it('returns the single destination when only one is present', () => {
    expect(pickCheapestDestination([btcDest])).toBe(btcDest)
  })

  it('prefers ark over lightning and on-chain', () => {
    expect(pickCheapestDestination([btcDest, bolt11Dest, arkDest])).toBe(arkDest)
  })

  it('prefers lightning over on-chain when no ark is present', () => {
    expect(pickCheapestDestination([btcDest, bolt11Dest])).toBe(bolt11Dest)
  })

  it('falls back to on-chain when it is the only option', () => {
    expect(pickCheapestDestination([btcDest])).toBe(btcDest)
  })

  it('treats all lightning variants as same priority', () => {
    const result = pickCheapestDestination([btcDest, lnurlDest, lnaddressDest, bolt12Dest])
    expect(
      result.type === 'lnurl' || result.type === 'lnaddress' || result.type === 'bolt12'
    ).toBeTruthy()
  })

  it('does not mutate the input array', () => {
    const input = [btcDest, arkDest, bolt11Dest]
    const snapshot = [...input]
    pickCheapestDestination(input)
    expect(input).toStrictEqual(snapshot)
  })
})
