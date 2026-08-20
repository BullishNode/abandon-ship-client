import type { DecodedPayment, Destination } from 'bitcoin-decoder'
import { decode } from 'bitcoin-decoder'
import { describe, expect, it, vi } from 'vitest'
import { normalizeDestination } from './bitcoin'
import {
  destinationMatchesWalletNetwork,
  getSelectableDestinations,
  getSendRoute,
  parsePaymentInput,
  pickCheapestDestination,
  restrictPaymentToNetwork,
  sanitizePaymentInput
} from './payment'

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

const MAINNET_ADDRESS = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'
const MAINNET_TAPROOT = 'bc1pqqqsyqcyq5rqwzqfpg9scrgwpugpzysnzs23v9ccrydpk8qarc0sg5tmnz'
const SIGNET_ADDRESS = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'
const REGTEST_ADDRESS = 'bcrt1qw508d6qejxtdg4y5r3zarvary0c5xw7kygt080'
const LNADDRESS = 'carlos@second.tech'

describe(destinationMatchesWalletNetwork, () => {
  it('accepts a mainnet address only on a mainnet wallet', () => {
    const mainnet = makeDestination('bitcoin-address', MAINNET_ADDRESS)

    expect(destinationMatchesWalletNetwork(mainnet, 'mainnet')).toBeTruthy()
    expect(destinationMatchesWalletNetwork(mainnet, 'signet')).toBeFalsy()
    expect(destinationMatchesWalletNetwork(mainnet, 'mutinynet')).toBeFalsy()
    expect(destinationMatchesWalletNetwork(mainnet, 'regtest')).toBeFalsy()
  })

  it('accepts a signet address on signet and mutinynet wallets', () => {
    const signet = makeDestination('bitcoin-address', SIGNET_ADDRESS)

    expect(destinationMatchesWalletNetwork(signet, 'signet')).toBeTruthy()
    expect(destinationMatchesWalletNetwork(signet, 'mutinynet')).toBeTruthy()
    expect(destinationMatchesWalletNetwork(signet, 'mainnet')).toBeFalsy()
    expect(destinationMatchesWalletNetwork(signet, 'regtest')).toBeFalsy()
  })

  it('accepts a regtest address only on a regtest wallet', () => {
    const regtest = makeDestination('bitcoin-address', REGTEST_ADDRESS)

    expect(destinationMatchesWalletNetwork(regtest, 'regtest')).toBeTruthy()
    expect(destinationMatchesWalletNetwork(regtest, 'signet')).toBeFalsy()
    expect(destinationMatchesWalletNetwork(regtest, 'mutinynet')).toBeFalsy()
    expect(destinationMatchesWalletNetwork(regtest, 'mainnet')).toBeFalsy()
  })

  it('accepts on-chain addresses regardless of case', () => {
    const upper = makeDestination('bitcoin-address', MAINNET_ADDRESS.toUpperCase())
    expect(destinationMatchesWalletNetwork(upper, 'mainnet')).toBeTruthy()
    expect(destinationMatchesWalletNetwork(upper, 'signet')).toBeFalsy()
  })

  it('checks taproot addresses without an initialized ECC library', () => {
    const taproot = makeDestination('bitcoin-address', MAINNET_TAPROOT)
    expect(destinationMatchesWalletNetwork(taproot, 'mainnet')).toBeTruthy()
    expect(destinationMatchesWalletNetwork(taproot, 'signet')).toBeFalsy()
  })

  it('rejects on-chain addresses that are not valid on any network', () => {
    const garbage = makeDestination('bitcoin-address', 'bc1qnotanaddress')
    expect(destinationMatchesWalletNetwork(garbage, 'mainnet')).toBeFalsy()
    expect(destinationMatchesWalletNetwork(garbage, 'signet')).toBeFalsy()
  })

  it('checks ark addresses by their human readable part', () => {
    const mainnet = makeDestination('ark-address', 'ark1abcdefgh')
    const testnet = makeDestination('ark-address', 'tark1abcdefgh')

    expect(destinationMatchesWalletNetwork(mainnet, 'mainnet')).toBeTruthy()
    expect(destinationMatchesWalletNetwork(mainnet, 'signet')).toBeFalsy()
    expect(destinationMatchesWalletNetwork(testnet, 'signet')).toBeTruthy()
    expect(destinationMatchesWalletNetwork(testnet, 'mutinynet')).toBeTruthy()
    expect(destinationMatchesWalletNetwork(testnet, 'regtest')).toBeTruthy()
    expect(destinationMatchesWalletNetwork(testnet, 'mainnet')).toBeFalsy()
  })

  it('checks chain specific bolt11 prefixes', () => {
    const mainnet = makeDestination('bolt11', 'lnbc500u1p3invoice')
    const signet = makeDestination('bolt11', 'lntbs500u1p3invoice')
    const regtest = makeDestination('bolt11', 'lnbcrt500u1p3invoice')

    expect(destinationMatchesWalletNetwork(mainnet, 'mainnet')).toBeTruthy()
    expect(destinationMatchesWalletNetwork(mainnet, 'signet')).toBeFalsy()

    expect(destinationMatchesWalletNetwork(signet, 'signet')).toBeTruthy()
    expect(destinationMatchesWalletNetwork(signet, 'mutinynet')).toBeTruthy()
    expect(destinationMatchesWalletNetwork(signet, 'regtest')).toBeFalsy()
    expect(destinationMatchesWalletNetwork(signet, 'mainnet')).toBeFalsy()

    expect(destinationMatchesWalletNetwork(regtest, 'regtest')).toBeTruthy()
    expect(destinationMatchesWalletNetwork(regtest, 'signet')).toBeFalsy()
    expect(destinationMatchesWalletNetwork(regtest, 'mainnet')).toBeFalsy()
  })

  it('keeps lntb invoices payable on every non-mainnet wallet', () => {
    // `lntb` is testnet3/4 but also what older signet nodes emit.
    const testnet = makeDestination('bolt11', 'lntb500u1p3invoice')

    expect(destinationMatchesWalletNetwork(testnet, 'signet')).toBeTruthy()
    expect(destinationMatchesWalletNetwork(testnet, 'mutinynet')).toBeTruthy()
    expect(destinationMatchesWalletNetwork(testnet, 'regtest')).toBeTruthy()
    expect(destinationMatchesWalletNetwork(testnet, 'mainnet')).toBeFalsy()
  })

  it('accepts destinations whose network cannot be derived', () => {
    const offer = makeDestination('bolt12', 'lno1pqqnyzsmx5cx6umpwssx6atvw35j6ut4v9h9g')
    const lnurl = makeDestination('lnurl', 'lnurl1dp68gurn8ghj7')
    const lnaddress = makeDestination('lnaddress', LNADDRESS)

    for (const destination of [offer, lnurl, lnaddress]) {
      expect(destinationMatchesWalletNetwork(destination, 'mainnet')).toBeTruthy()
      expect(destinationMatchesWalletNetwork(destination, 'signet')).toBeTruthy()
      expect(destinationMatchesWalletNetwork(destination, 'regtest')).toBeTruthy()
    }
  })
})

function makePayment(
  destinations: Destination[],
  network: DecodedPayment['network']
): DecodedPayment {
  return {
    destination: destinations[0],
    destinations,
    input: 'bitcoin:example',
    kind: 'payment',
    network,
    valid: true
  }
}

describe(restrictPaymentToNetwork, () => {
  it('returns the payment unchanged when every rail matches', () => {
    const payment = makePayment(
      [makeDestination('lnaddress', LNADDRESS), makeDestination('bitcoin-address', SIGNET_ADDRESS)],
      'unknown'
    )
    expect(restrictPaymentToNetwork(payment, 'signet')).toBe(payment)
  })

  it('drops the rails the wallet cannot pay and repoints the primary destination', () => {
    const lnaddress = makeDestination('lnaddress', LNADDRESS)
    const mainnetOnchain = makeDestination('bitcoin-address', MAINNET_ADDRESS)
    const payment = makePayment([mainnetOnchain, lnaddress], 'unknown')

    const restricted = restrictPaymentToNetwork(payment, 'signet')

    expect(restricted?.destinations).toStrictEqual([lnaddress])
    expect(restricted?.destination).toStrictEqual(lnaddress)
  })

  it('keeps the metadata of the original payment', () => {
    const payment: DecodedPayment = {
      ...makePayment(
        [
          makeDestination('bitcoin-address', MAINNET_ADDRESS),
          makeDestination('lnaddress', LNADDRESS)
        ],
        'unknown'
      ),
      metadata: { amount: 1000, description: 'coffee' }
    }

    expect(restrictPaymentToNetwork(payment, 'signet')?.metadata).toStrictEqual({
      amount: 1000,
      description: 'coffee'
    })
  })

  it('returns undefined when no rail is payable', () => {
    const payment = makePayment(
      [
        makeDestination('bitcoin-address', MAINNET_ADDRESS),
        makeDestination('bolt11', 'lnbc500u1p3invoice')
      ],
      'mainnet'
    )
    expect(restrictPaymentToNetwork(payment, 'signet')).toBeUndefined()
  })

  it('ignores the payment level network reported by the decoder', () => {
    // The decoder reads `testnet` off the `m` in the lightning address here.
    const payment = makePayment(
      [
        makeDestination('lnaddress', 'mike@getalby.com'),
        makeDestination('bitcoin-address', MAINNET_ADDRESS)
      ],
      'testnet'
    )
    expect(restrictPaymentToNetwork(payment, 'mainnet')).toBe(payment)
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

  it('strips internal whitespace from a soft-wrapped paste before decoding', async () => {
    mockDecode.mockResolvedValue({
      destination: bolt11Dest,
      destinations: [bolt11Dest],
      input: 'lnbc1abc',
      kind: 'payment',
      network: 'mainnet',
      valid: true
    })

    await parsePaymentInput('bitcoin:bc1qabc\n?ark=ark1ab c\t&lightning=lnbc1abc')
    expect(mockDecode).toHaveBeenCalledWith('bitcoin:bc1qabc?ark=ark1abc&lightning=lnbc1abc')
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

describe(sanitizePaymentInput, () => {
  it('removes internal spaces, tabs and newlines', () => {
    expect(sanitizePaymentInput('bitcoin:bc1qabc\n\t ?amount=1')).toBe('bitcoin:bc1qabc?amount=1')
  })

  it('leaves a clean string untouched', () => {
    expect(sanitizePaymentInput('lnbc1abc')).toBe('lnbc1abc')
  })

  it('trims leading and trailing whitespace', () => {
    expect(sanitizePaymentInput('  ark1abc  ')).toBe('ark1abc')
  })
})

describe(getSelectableDestinations, () => {
  const upperArk = makeDestination('ark-address', 'ARK1ABC')
  const upperBolt11 = makeDestination('bolt11', 'LNBC10U1ABC')
  const upperBtc = makeDestination('bitcoin-address', 'BC1QABC')

  it('lowercases ark and lightning destinations so they match the stored selection', () => {
    const [first] = getSelectableDestinations([upperArk])
    expect(first.destination).toBe('ark1abc')
  })

  it('lowercases bech32 bitcoin addresses', () => {
    const [first] = getSelectableDestinations([upperBtc])
    expect(first.destination).toBe('bc1qabc')
  })

  it('keeps priority order (ark before lightning before on-chain)', () => {
    const result = getSelectableDestinations([upperBtc, upperBolt11, upperArk])
    expect(result.map((d) => d.type)).toStrictEqual(['ark-address', 'bolt11', 'bitcoin-address'])
  })

  it('produces destinations whose identity equals the normalized picked destination', () => {
    const destinations = [upperBtc, upperArk, upperBolt11]
    const selectable = getSelectableDestinations(destinations)
    const picked = pickCheapestDestination(destinations)
    const selectedValue = normalizeDestination(picked).destination
    expect(selectable.some((d) => d.destination === selectedValue)).toBeTruthy()
  })

  it('does not mutate the input array', () => {
    const input = [upperBtc, upperArk]
    const snapshot = [...input]
    getSelectableDestinations(input)
    expect(input).toStrictEqual(snapshot)
  })
})
