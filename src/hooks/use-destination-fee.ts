import type { Destination } from 'bitcoin-decoder'
import { useLightningSendFee } from '@/hooks/barkd/use-lightning-send-fee'
import { useSendOnchainFee } from '@/hooks/barkd/use-send-onchain-fee'

interface DestinationFee {
  feeSat: number | undefined
  isFetching: boolean
}

export function useDestinationFee(
  destination: Destination,
  amountSat: number | undefined
): DestinationFee {
  const isLightning =
    destination.type === 'bolt11' ||
    destination.type === 'bolt12' ||
    destination.type === 'lnaddress' ||
    destination.type === 'lnurl'
  const isOnchain = destination.type === 'bitcoin-address'

  const { data: lightningFee, isFetching: isFetchingLn } = useLightningSendFee(
    isLightning ? amountSat : undefined
  )
  const { data: onchainFee, isFetching: isFetchingOnchain } = useSendOnchainFee(
    isOnchain ? amountSat : undefined,
    isOnchain ? destination.destination : undefined
  )

  if (destination.type === 'ark-address') {
    return { feeSat: 0, isFetching: false }
  }
  if (isLightning) {
    return { feeSat: lightningFee?.feeSat, isFetching: isFetchingLn }
  }
  return { feeSat: onchainFee?.feeSat, isFetching: isFetchingOnchain }
}
