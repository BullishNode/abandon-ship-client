import { CheckIcon, CopyIcon, PencilSimpleIcon } from '@phosphor-icons/react'
import type { Movement } from '@secondts/barkd'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MovementAmountCell } from '@/components/movement-amount-cell'
import { MovementSourceBadge } from '@/components/movement-source-badge'
import { MovementStatusBadge } from '@/components/movement-status-badge'
import { TagInput } from '@/components/tag-input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useMetadataStore } from '@/stores/metadata'
import {
  getMovementCounterpartyDestination,
  getMovementDirection,
  getMovementFeeSat,
  getMovementSource
} from '@/utils/movement'

const COPY_RESET_MS = 1500

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
      <DialogContent className="sm:max-w-lg" onOpenAutoFocus={(event) => event.preventDefault()}>
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
        <LabelEditor
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
        {counterparty ? (
          <CounterpartyRow label={counterpartyLabel} value={counterparty.destination.value} />
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
      </div>
    </>
  )
}

interface DetailRowProps {
  label: string
  value: string
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right break-all">{value}</span>
    </div>
  )
}

interface CounterpartyRowProps {
  label: string
  value: string
}

function CounterpartyRow({ label, value }: CounterpartyRowProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  async function copyValue() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), COPY_RESET_MS)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-start gap-2 max-w-[70%]">
        <span className="font-mono text-xs break-all">{value}</span>
        <Button
          aria-label={copied ? t('movements.detail.copied') : t('movements.detail.copy')}
          onClick={() => {
            void copyValue()
          }}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </Button>
      </div>
    </div>
  )
}

interface LabelEditorProps {
  label: string
  onSave: (label: string) => void
}

function LabelEditor({ label, onSave }: LabelEditorProps) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(label)
  function startEditing() {
    setDraft(label)
    setEditing(true)
  }
  function handleCancel() {
    setDraft(label)
    setEditing(false)
  }
  function handleSave() {
    onSave(draft.trim())
    setEditing(false)
  }
  if (editing) {
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor="movement-label">{t('movements.detail.label')}</Label>
        <div className="flex items-center gap-2">
          <Input
            autoFocus
            id="movement-label"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                handleSave()
              }
              if (event.key === 'Escape') {
                event.preventDefault()
                handleCancel()
              }
            }}
            placeholder={t('movements.detail.labelPlaceholder')}
            value={draft}
          />
          <Button onClick={handleSave} size="sm" type="button">
            {t('movements.detail.save')}
          </Button>
          <Button onClick={handleCancel} size="sm" type="button" variant="ghost">
            {t('movements.detail.cancel')}
          </Button>
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <Label>{t('movements.detail.label')}</Label>
      <div className="flex items-center gap-2">
        <span
          className={
            label.length > 0 ? 'flex-1 text-foreground' : 'flex-1 text-muted-foreground italic'
          }
        >
          {label.length > 0 ? label : t('movements.detail.labelPlaceholder')}
        </span>
        <Button
          aria-label={t('movements.detail.edit')}
          onClick={startEditing}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <PencilSimpleIcon />
        </Button>
      </div>
    </div>
  )
}
