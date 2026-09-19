import { PencilSimpleIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { CopyableValueRow } from '@/components/movement-detail-shared'
import { Button } from '@/components/ui/button'
import { formatAddress } from '@/utils/format'

interface ClaimAddressRowProps {
  label: string
  emptyLabel: string
  address?: string
  onEdit?: () => void
}

export function ClaimAddressRow({ label, emptyLabel, address, onEdit }: ClaimAddressRowProps) {
  const { t } = useTranslation()
  const editButton =
    onEdit === undefined ? null : (
      <Button
        aria-label={t('vtxos.detail.change_claim_address')}
        onClick={onEdit}
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        <PencilSimpleIcon />
      </Button>
    )
  if (address === undefined || address.length === 0) {
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="select-none text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-muted-foreground text-xs italic">{emptyLabel}</span>
          {editButton}
        </div>
      </div>
    )
  }
  return (
    <CopyableValueRow
      action={editButton}
      displayValue={formatAddress(address, 8, 8)}
      label={label}
      value={address}
    />
  )
}
