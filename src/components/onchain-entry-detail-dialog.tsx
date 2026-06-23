import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { MovementAmountCell } from '@/components/movement-amount-cell'
import { CopyableValueRow, DetailRow, LabelEditor } from '@/components/movement-detail-shared'
import { MovementSourceBadge } from '@/components/movement-source-badge'
import { MovementStatusBadge } from '@/components/movement-status-badge'
import { TagInput } from '@/components/tag-input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useMetadataStore } from '@/stores/metadata'
import { useWalletStore } from '@/stores/wallet'
import { getOnchainDefaultLabel } from '@/utils/movement-labels'
import type { OnchainTxEntry } from '@/utils/movements-feed'

interface OnchainEntryDetailDialogProps {
  entry: OnchainTxEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
  formatSats: (sats: number) => string
  formatFiat: (sats: number) => string
  formatDateAbsolute: (date: Date) => string
  discreetMode: boolean
}

export function OnchainEntryDetailDialog({
  entry,
  open,
  onOpenChange,
  formatSats,
  formatFiat,
  formatDateAbsolute,
  discreetMode
}: OnchainEntryDetailDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        aria-describedby={undefined}
        className="sm:max-w-lg"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        {entry ? (
          <OnchainEntryDetailContent
            discreetMode={discreetMode}
            entry={entry}
            formatDateAbsolute={formatDateAbsolute}
            formatFiat={formatFiat}
            formatSats={formatSats}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

interface OnchainEntryDetailContentProps {
  entry: OnchainTxEntry
  formatSats: (sats: number) => string
  formatFiat: (sats: number) => string
  formatDateAbsolute: (date: Date) => string
  discreetMode: boolean
}

function OnchainEntryDetailContent({
  entry,
  formatSats,
  formatFiat,
  formatDateAbsolute,
  discreetMode
}: OnchainEntryDetailContentProps) {
  const { t } = useTranslation()
  const fingerprint = useWalletStore((state) => state.wallet?.fingerprint)
  const [annotation, setOnchainAnnotation] = useMetadataStore(
    useShallow((state) => [
      fingerprint === undefined ? undefined : state.onchainAnnotations[fingerprint]?.[entry.txid],
      state.setOnchainAnnotation
    ])
  )
  const heightValue =
    entry.confirmationHeight === null
      ? t('movements.onchain.detail.pending')
      : String(entry.confirmationHeight)
  const isOptimistic = entry.isOptimistic === true
  function resolveFeeValue(): string {
    if (isOptimistic) {
      return t('movements.onchain.detail.pending')
    }
    if (entry.feeSat === null) {
      return t('movements.detail.fee_unavailable')
    }
    return `${formatSats(entry.feeSat)} · ${formatFiat(entry.feeSat)}`
  }
  const feeValue = resolveFeeValue()
  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('movements.onchain.detail.title')}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col divide-y divide-border *:py-3 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">
          <div className="flex items-start justify-between gap-3">
            <MovementAmountCell
              align="start"
              discreetMode={discreetMode}
              formatFiat={formatFiat}
              formatSats={formatSats}
              pending={isOptimistic}
              sats={entry.amountSat}
              size="lg"
            />
            <div className="flex flex-col items-end gap-2">
              <MovementStatusBadge status={entry.status} />
              <MovementSourceBadge source={entry.isCpfp ? 'exit' : 'onchain'} />
            </div>
          </div>
          <CopyableValueRow label={t('movements.onchain.detail.txid')} value={entry.txid} />
          <DetailRow label={t('movements.onchain.detail.height')} value={heightValue} />
          <DetailRow label={t('movements.detail.fee')} value={feeValue} />
          <DetailRow
            label={t('movements.detail.date_created')}
            value={formatDateAbsolute(new Date(entry.approximateTimestampMs))}
          />
        </div>
        <LabelEditor
          inputId="onchain-label"
          label={annotation?.label ?? getOnchainDefaultLabel(entry.isCpfp, t)}
          onSave={(nextLabel) => {
            setOnchainAnnotation(entry.txid, {
              label: nextLabel,
              tags: annotation?.tags ?? []
            })
          }}
        />
        <div className="flex flex-col gap-2">
          <Label>{t('movements.detail.tags')}</Label>
          <TagInput
            onChange={(nextTags) => {
              setOnchainAnnotation(entry.txid, {
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
