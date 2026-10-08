import { CheckIcon, CopyIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { MovementAmountCell } from '@/components/movement-amount-cell'
import { CopyableValueRow, DetailRow, LabelEditor } from '@/components/movement-detail-shared'
import { MovementSourceBadge } from '@/components/movement-source-badge'
import { MovementStatusBadge } from '@/components/movement-status-badge'
import { TagInput } from '@/components/tag-input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useUpdateMovementMetadata } from '@/hooks/barkd/use-update-movement-metadata'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import type { Movement } from '@/types/domain/movement'
import type { WalletTx } from '@/types/domain/onchain'
import { getMovementMetadata } from '@/utils/metadata'
import {
  getMovementCounterpartyDestination,
  getMovementDirection,
  getMovementDisplayBalanceSats,
  getMovementFeeSat,
  getMovementPayoutFeeSat,
  getMovementRawJson,
  getMovementSource
} from '@/utils/movement'

interface MovementDetailDialogProps {
  movement: Movement | null
  transactions: WalletTx[]
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
  transactions: WalletTx[]
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
  const updateMetadata = useUpdateMovementMetadata()
  const direction = getMovementDirection(movement)
  const counterparty = getMovementCounterpartyDestination(movement)
  const source = getMovementSource(movement)
  const fee = getMovementFeeSat(movement, transactions)
  const payoutFee = getMovementPayoutFeeSat(movement)
  let counterpartyLabel =
    direction === 'outgoing' ? t('movements.detail.sent_to') : t('movements.detail.received_on')
  if (source === 'expiry_payout') {
    counterpartyLabel = t('movements.detail.own_onchain_address')
  }
  const completedAt =
    typeof movement.completedAt === 'string' &&
    new Date(movement.completedAt).getTime() !== new Date(movement.createdAt).getTime()
      ? movement.completedAt
      : null
  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('movements.detail.title')}</DialogTitle>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-5">
        <div className="flex flex-col divide-y divide-border *:py-3 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">
          <div className="flex items-start justify-between gap-3">
            <MovementAmountCell
              align="start"
              discreetMode={discreetMode}
              formatFiat={formatFiat}
              formatSats={formatSats}
              sats={getMovementDisplayBalanceSats(movement)}
              size="lg"
            />
            <div className="flex flex-col items-end gap-2">
              <MovementStatusBadge status={movement.status} />
              <MovementSourceBadge source={source} />
            </div>
          </div>
          {source === 'expiry_payout' ? (
            <p className="text-sm text-muted-foreground">
              {t('movements.detail.expiry_transfer_description')}
            </p>
          ) : null}
          {counterparty ? (
            <CopyableValueRow label={counterpartyLabel} value={counterparty.value} />
          ) : (
            <DetailRow label={counterpartyLabel} value={t('movements.detail.no_counterparty')} />
          )}
          <DetailRow
            label={t(
              source === 'expiry_payout'
                ? 'movements.detail.wallet_transfer_fee'
                : 'movements.detail.fee'
            )}
            value={
              fee === null
                ? t('movements.detail.fee_unavailable')
                : `${formatSats(fee)} · ${formatFiat(fee)}`
            }
          />
          {source === 'expiry_payout' ? (
            <DetailRow
              label={t('movements.detail.payout_fee')}
              value={
                payoutFee === null
                  ? t('movements.detail.fee_unavailable')
                  : `${formatSats(payoutFee)} · ${formatFiat(payoutFee)}`
              }
            />
          ) : null}
          <DetailRow
            label={t('movements.detail.date_created')}
            value={formatDateAbsolute(new Date(movement.createdAt))}
          />
          {completedAt !== null && (
            <DetailRow
              label={t('movements.detail.date_completed')}
              value={formatDateAbsolute(new Date(completedAt))}
            />
          )}
        </div>
        <LabelEditor
          inputId="movement-label"
          label={metadata?.label ?? ''}
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
      </DialogBody>
    </>
  )
}
