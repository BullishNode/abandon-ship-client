import type { Destination } from 'bitcoin-decoder'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleArkIcon } from '@/components/icons/circle-ark'
import { CircleLightningIcon } from '@/components/icons/circle-lightning'
import { CircleOnchainIcon } from '@/components/icons/circle-onchain'
import { Badge } from '@/components/ui/badge'
import { useDestinationFee } from '@/hooks/use-destination-fee'
import { useFormatBitcoin } from '@/hooks/use-format-bitcoin'
import { cn } from '@/lib/utils'

function getDestinationIcon(type: Destination['type']): ComponentType {
  if (type === 'ark-address') {
    return CircleArkIcon
  }
  if (type === 'bitcoin-address') {
    return CircleOnchainIcon
  }
  return CircleLightningIcon
}

interface DestinationPickerProps {
  destinations: Destination[]
  amountSat: number | undefined
  selectedDestination: string
  onSelect: (destination: Destination) => void
}

interface DestinationBadgeProps {
  destination: Destination
  amountSat: number | undefined
  isSelected: boolean
  onSelect: () => void
}

function getTypeLabelKey(type: Destination['type']): string {
  if (type === 'ark-address') {
    return 'send.route.ark'
  }
  if (type === 'bitcoin-address') {
    return 'send.route.onchain_from_ark'
  }
  return 'send.route.lightning'
}

function DestinationBadge({ destination, amountSat, isSelected, onSelect }: DestinationBadgeProps) {
  const { t } = useTranslation()
  const formatBitcoin = useFormatBitcoin()
  const { feeSat, isFetching } = useDestinationFee(destination, amountSat)
  const Icon = getDestinationIcon(destination.type)

  let feeLabel = '—'
  if (destination.type === 'ark-address') {
    feeLabel = t('send.fee.free')
  } else if (isFetching) {
    feeLabel = '...'
  } else if (feeSat !== undefined) {
    feeLabel = formatBitcoin(feeSat)
  }

  return (
    <button
      className={cn(
        'rounded-full transition-opacity',
        isSelected ? '' : 'opacity-60 hover:opacity-100'
      )}
      onClick={onSelect}
      type="button"
    >
      <Badge variant={isSelected ? 'default' : 'outline'}>
        <Icon />
        {t(getTypeLabelKey(destination.type))}
        <span className="opacity-70">· {feeLabel}</span>
      </Badge>
    </button>
  )
}

export function DestinationPicker({
  destinations,
  amountSat,
  selectedDestination,
  onSelect
}: DestinationPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {destinations.map((dest) => (
        <DestinationBadge
          amountSat={amountSat}
          destination={dest}
          isSelected={dest.destination === selectedDestination}
          key={`${dest.type}-${dest.destination}`}
          onSelect={() => onSelect(dest)}
        />
      ))}
    </div>
  )
}
