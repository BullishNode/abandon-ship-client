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
import type { OnchainTxEntry } from '@/utils/movements-feed'

interface OnchainEntryDetailDialogProps {
  entry: OnchainTxEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
  formatSats: (sats: number) => string
  formatFiat: (sats: number) => string
  formatDateAbsolute: (date: Date) => string
  discreteMode: boolean
}

export function OnchainEntryDetailDialog({
  entry,
  open,
  onOpenChange,
  formatSats,
  formatFiat,
  formatDateAbsolute,
  discreteMode
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
            discreteMode={discreteMode}
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
  discreteMode: boolean
}

function OnchainEntryDetailContent({
  entry,
  formatSats,
  formatFiat,
  formatDateAbsolute,
  discreteMode
}: OnchainEntryDetailContentProps) {
  const { t } = useTranslation()
  const [annotation, setOnchainAnnotation] = useMetadataStore(
    useShallow((state) => [state.onchainAnnotations[entry.txid], state.setOnchainAnnotation])
  )
  const heightValue =
    entry.confirmationHeight === null
      ? t('movements.onchain.detail.pending')
      : String(entry.confirmationHeight)
  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('movements.onchain.detail.title')}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col items-start gap-2">
            <MovementStatusBadge status={entry.status} />
            <MovementSourceBadge source="onchain" />
          </div>
          <MovementAmountCell
            discreteMode={discreteMode}
            formatFiat={formatFiat}
            formatSats={formatSats}
            sats={entry.amountSat}
          />
        </div>
        <CopyableValueRow label={t('movements.onchain.detail.txid')} value={entry.txid} />
        <DetailRow label={t('movements.onchain.detail.height')} value={heightValue} />
        <DetailRow
          label={t('movements.detail.dateCreated')}
          value={formatDateAbsolute(new Date(entry.approximateTimestampMs))}
        />
        <LabelEditor
          inputId="onchain-label"
          label={annotation?.label ?? ''}
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
