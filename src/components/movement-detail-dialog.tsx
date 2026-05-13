import type { Movement } from '@secondts/barkd'
import { useTranslation } from 'react-i18next'
import { MovementAmountCell } from '@/components/movement-amount-cell'
import { CopyableValueRow, DetailRow, LabelEditor } from '@/components/movement-detail-shared'
import { MovementSourceBadge } from '@/components/movement-source-badge'
import { MovementStatusBadge } from '@/components/movement-status-badge'
import { TagInput } from '@/components/tag-input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useMetadataStore } from '@/stores/metadata'
import {
  getMovementCounterpartyDestination,
  getMovementDirection,
  getMovementFeeSat,
  getMovementSource
} from '@/utils/movement'

interface MovementDetailDialogProps {
  movement: Movement | null
  open: boolean
  onOpenChange: (open: boolean) => void
  formatSats: (sats: number) => string
  formatFiat: (sats: number) => string
  formatDateAbsolute: (date: Date) => string
  discreteMode: boolean
}

export function MovementDetailDialog({
  movement,
  open,
  onOpenChange,
  formatSats,
  formatFiat,
  formatDateAbsolute,
  discreteMode
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
            discreteMode={discreteMode}
            formatDateAbsolute={formatDateAbsolute}
            formatFiat={formatFiat}
            formatSats={formatSats}
            movement={movement}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

interface MovementDetailContentProps {
  movement: Movement
  formatSats: (sats: number) => string
  formatFiat: (sats: number) => string
  formatDateAbsolute: (date: Date) => string
  discreteMode: boolean
}

function MovementDetailContent({
  movement,
  formatSats,
  formatFiat,
  formatDateAbsolute,
  discreteMode
}: MovementDetailContentProps) {
  const { t } = useTranslation()
  const movementId = movement.id
  const annotation = useMetadataStore((state) => state.annotations[movementId])
  const setManualAnnotation = useMetadataStore((state) => state.setManualAnnotation)
  const direction = getMovementDirection(movement)
  const counterparty = getMovementCounterpartyDestination(movement)
  const source = getMovementSource(movement)
  const fee = getMovementFeeSat(movement)
  const counterpartyLabel =
    direction === 'outgoing' ? t('movements.detail.sentTo') : t('movements.detail.receivedOn')
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
            discreteMode={discreteMode}
            formatFiat={formatFiat}
            formatSats={formatSats}
            sats={movement.effectiveBalanceSat}
          />
        </div>
        {counterparty ? (
          <CopyableValueRow label={counterpartyLabel} value={counterparty.destination.value} />
        ) : (
          <DetailRow label={counterpartyLabel} value={t('movements.detail.noCounterparty')} />
        )}
        <DetailRow
          label={t('movements.detail.fee')}
          value={
            fee === null
              ? t('movements.detail.feeUnavailable')
              : `${formatSats(fee)} · ${formatFiat(fee)}`
          }
        />
        <DetailRow
          label={t('movements.detail.dateCreated')}
          value={formatDateAbsolute(movement.time.createdAt)}
        />
        {completedAt ? (
          <DetailRow
            label={t('movements.detail.dateCompleted')}
            value={formatDateAbsolute(completedAt)}
          />
        ) : null}
        <LabelEditor
          inputId="movement-label"
          label={annotation?.label ?? ''}
          onSave={(nextLabel) => {
            setManualAnnotation(movementId, {
              contactId: annotation?.contactId,
              label: nextLabel,
              tags: annotation?.tags ?? []
            })
          }}
        />
        <div className="flex flex-col gap-2">
          <Label>{t('movements.detail.tags')}</Label>
          <TagInput
            onChange={(nextTags) => {
              setManualAnnotation(movementId, {
                contactId: annotation?.contactId,
                label: annotation?.label,
                tags: nextTags
              })
            }}
            value={annotation?.tags ?? []}
          />
        </div>
      </div>
    </>
  )
}
