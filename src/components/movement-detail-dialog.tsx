import { CheckIcon, CopyIcon } from '@phosphor-icons/react'
import type { Movement, WalletTxInfo } from '@secondts/barkd'
import { useTranslation } from 'react-i18next'
import { MovementAmountCell } from '@/components/movement-amount-cell'
import { CopyableValueRow, DetailRow, LabelEditor } from '@/components/movement-detail-shared'
import { MovementSourceBadge } from '@/components/movement-source-badge'
import { MovementStatusBadge } from '@/components/movement-status-badge'
import { TagInput } from '@/components/tag-input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useUpdateMovementMetadata } from '@/hooks/barkd/use-update-movement-metadata'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { getMovementMetadata } from '@/utils/metadata'
import { getMovementDefaultLabel } from '@/utils/movement-labels'
import {
  getMovementCounterpartyDestination,
  getMovementDirection,
  getMovementFeeSat,
  getMovementRawJson,
  getMovementSource
} from '@/utils/movement'

interface MovementDetailDialogProps {
  movement: Movement | null
  transactions: WalletTxInfo[]
  open: boolean
  onOpenChange: (open: boolean) => void
  formatSats: (sats: number) => string
  formatFiat: (sats: number) => string
  formatDateAbsolute: (date: Date) => string
  discreetMode: boolean
}

export function MovementDetailDialog({
  movement,
  transactions,
  open,
  onOpenChange,
  formatSats,
  formatFiat,
  formatDateAbsolute,
  discreetMode
}: MovementDetailDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        aria-describedby={undefined}
        className="sm:max-w-lg"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        {movement ? (
          <MovementDetailContent
            discreetMode={discreetMode}
            formatDateAbsolute={formatDateAbsolute}
            formatFiat={formatFiat}
            formatSats={formatSats}
            movement={movement}
            transactions={transactions}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

interface MovementDetailContentProps {
  movement: Movement
  transactions: WalletTxInfo[]
  formatSats: (sats: number) => string
  formatFiat: (sats: number) => string
  formatDateAbsolute: (date: Date) => string
  discreetMode: boolean
}

function MovementDetailContent({
  movement,
  transactions,
  formatSats,
  formatFiat,
  formatDateAbsolute,
  discreetMode
}: MovementDetailContentProps) {
  const { t } = useTranslation()
  const { copy, isCopied } = useCopyToClipboard()
  const movementId = movement.id
  const metadata = getMovementMetadata(movement)
  const defaultLabel = getMovementDefaultLabel(movement.subsystem, t)
  const updateMetadata = useUpdateMovementMetadata()
  const direction = getMovementDirection(movement)
  const counterparty = getMovementCounterpartyDestination(movement)
  const source = getMovementSource(movement)
  const fee = getMovementFeeSat(movement, transactions)
  const counterpartyLabel =
    direction === 'outgoing' ? t('movements.detail.sent_to') : t('movements.detail.received_on')
  const completedAt =
    movement.time.completedAt &&
    movement.time.completedAt.getTime() !== movement.time.createdAt.getTime()
      ? movement.time.completedAt
      : null
  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('movements.detail.title')}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col items-start gap-2">
            <MovementStatusBadge status={movement.status} />
            <MovementSourceBadge source={source} />
          </div>
          <MovementAmountCell
            discreetMode={discreetMode}
            formatFiat={formatFiat}
            formatSats={formatSats}
            sats={movement.effectiveBalanceSat}
          />
        </div>
        {counterparty ? (
          <CopyableValueRow label={counterpartyLabel} value={counterparty.destination.value} />
        ) : (
          <DetailRow label={counterpartyLabel} value={t('movements.detail.no_counterparty')} />
        )}
        <DetailRow
          label={t('movements.detail.fee')}
          value={
            fee === null
              ? t('movements.detail.fee_unavailable')
              : `${formatSats(fee)} · ${formatFiat(fee)}`
          }
        />
        <DetailRow
          label={t('movements.detail.date_created')}
          value={formatDateAbsolute(movement.time.createdAt)}
        />
        {completedAt ? (
          <DetailRow
            label={t('movements.detail.date_completed')}
            value={formatDateAbsolute(completedAt)}
          />
        ) : null}
        <LabelEditor
          inputId="movement-label"
          label={metadata?.label ?? defaultLabel}
          onSave={(nextLabel) => {
            updateMetadata.mutate({
              id: movementId,
              patch: { label: nextLabel.length > 0 ? nextLabel : null }
            })
          }}
        />
        <div className="flex flex-col gap-2">
          <Label>{t('movements.detail.tags')}</Label>
          <TagInput
            onChange={(nextTags) => {
              updateMetadata.mutate({
                id: movementId,
                patch: { tags: nextTags.length > 0 ? nextTags : null }
              })
            }}
            value={metadata?.tags ?? []}
          />
        </div>
        <Button
          className="w-full"
          onClick={() => {
            void copy(getMovementRawJson(movement))
          }}
          type="button"
          variant="outline"
        >
          {isCopied ? <CheckIcon /> : <CopyIcon />}
          {isCopied ? t('movements.detail.copied') : t('movements.detail.copy_raw_json')}
        </Button>
      </div>
    </>
  )
}
