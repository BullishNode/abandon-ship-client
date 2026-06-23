import { CheckIcon, CopyIcon } from '@phosphor-icons/react'
import type { WalletVtxoInfo } from '@secondts/barkd'
import { useTranslation } from 'react-i18next'
import { CopyableValueRow, DetailRow } from '@/components/movement-detail-shared'
import { VtxoExitBadge } from '@/components/vtxos/vtxo-exit-badge'
import { VtxoStatusBadge } from '@/components/vtxos/vtxo-status-badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import type { VtxoExitPhase } from '@/utils/vtxo'
import { getExpiryTimeLabel, getVtxoRawJson, truncateVtxoId } from '@/utils/vtxo'

interface VtxoDetailDialogProps {
  vtxo: WalletVtxoInfo | null
  open: boolean
  onOpenChange: (open: boolean) => void
  formatSats: (sats: number) => string
  formatFiat: (sats: number) => string
  tipHeight?: number
  exitPhase?: VtxoExitPhase
}

export function VtxoDetailDialog({
  vtxo,
  open,
  onOpenChange,
  formatSats,
  formatFiat,
  tipHeight,
  exitPhase
}: VtxoDetailDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        aria-describedby={undefined}
        className="sm:max-w-lg"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        {vtxo ? (
          <VtxoDetailContent
            exitPhase={exitPhase}
            formatFiat={formatFiat}
            formatSats={formatSats}
            tipHeight={tipHeight}
            vtxo={vtxo}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

interface VtxoDetailContentProps {
  vtxo: WalletVtxoInfo
  formatSats: (sats: number) => string
  formatFiat: (sats: number) => string
  tipHeight?: number
  exitPhase?: VtxoExitPhase
}

function VtxoDetailContent({
  vtxo,
  formatSats,
  formatFiat,
  tipHeight,
  exitPhase
}: VtxoDetailContentProps) {
  const { t } = useTranslation()
  const { copy, isCopied } = useCopyToClipboard()
  const expiryTime = getExpiryTimeLabel(vtxo.expiryHeight, t, tipHeight)
  const expiryValue =
    expiryTime === '' ? String(vtxo.expiryHeight) : `${vtxo.expiryHeight} · ${expiryTime}`
  const lockedActionId = vtxo.state.type === 'locked' ? vtxo.state.actionId : undefined
  const lockedMovementId = vtxo.state.type === 'locked' ? vtxo.state.movementId : undefined
  const exitDepthValue =
    vtxo.exitDepth === undefined || vtxo.exitDepth === null ? '—' : String(vtxo.exitDepth)

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('vtxos.detail.title')}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-5 overflow-y-auto">
        <div className="flex flex-col divide-y divide-border *:py-3 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col leading-tight">
              <span className="font-semibold text-2xl tabular-nums">
                {formatSats(vtxo.amountSat)}
              </span>
              <span className="text-muted-foreground text-sm tabular-nums">
                {formatFiat(vtxo.amountSat)}
              </span>
            </div>
            {exitPhase === undefined ? (
              <VtxoStatusBadge status={vtxo.state.type} />
            ) : (
              <VtxoExitBadge phase={exitPhase} />
            )}
          </div>
          <DetailRow
            label={t('vtxos.detail.policy_type')}
            tooltip={t('vtxos.detail.policy_tooltip')}
            value={vtxo.policyType}
          />
          <DetailRow label={t('vtxos.detail.expiry')} value={expiryValue} />
          <DetailRow
            label={t('vtxos.detail.exit_delta')}
            tooltip={t('vtxos.detail.exit_delta_tooltip')}
            value={t('vtxos.detail.blocks_value', { count: vtxo.exitDelta })}
          />
          <DetailRow
            label={t('vtxos.detail.exit_depth')}
            tooltip={t('vtxos.detail.exit_depth_tooltip')}
            value={exitDepthValue}
          />
          <CopyableValueRow
            displayValue={truncateVtxoId(vtxo.id)}
            label={t('vtxos.detail.id')}
            value={vtxo.id}
          />
          <CopyableValueRow
            displayValue={truncateVtxoId(vtxo.chainAnchor)}
            label={t('vtxos.detail.chain_anchor')}
            value={vtxo.chainAnchor}
          />
          {lockedActionId === undefined ? null : (
            <DetailRow label={t('vtxos.detail.locked_action')} value={lockedActionId} />
          )}
          {lockedMovementId === undefined ? null : (
            <DetailRow label={t('vtxos.detail.locked_movement')} value={String(lockedMovementId)} />
          )}
        </div>
        <Button
          className="w-full"
          onClick={() => {
            void copy(getVtxoRawJson(vtxo))
          }}
          type="button"
          variant="outline"
        >
          {isCopied ? <CheckIcon /> : <CopyIcon />}
          {isCopied ? t('vtxos.detail.copied') : t('vtxos.detail.copy_raw_json')}
        </Button>
      </div>
    </>
  )
}
