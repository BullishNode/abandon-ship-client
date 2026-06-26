import { CheckIcon, CopyIcon } from '@phosphor-icons/react'
import type { WalletVtxoInfo } from '@secondts/barkd'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CopyableValueRow, DetailRow } from '@/components/movement-detail-shared'
import { ClaimAddressRow } from '@/components/vtxos/claim-address-row'
import { EditExitClaimAddressDialog } from '@/components/vtxos/edit-exit-claim-address-dialog'
import { VtxoExitBadge } from '@/components/vtxos/vtxo-exit-badge'
import { VtxoStatusBadge } from '@/components/vtxos/vtxo-status-badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import type { VtxoExitPhase, VtxoExitState } from '@/utils/vtxo'
import {
  getExpiryTimeLabel,
  getVtxoRawJson,
  isClaimAddressEditable,
  truncateVtxoId
} from '@/utils/vtxo'

interface VtxoDetailDialogProps {
  vtxo: WalletVtxoInfo | null
  open: boolean
  onOpenChange: (open: boolean) => void
  formatSats: (sats: number) => string
  formatFiat: (sats: number) => string
  tipHeight?: number
  exitPhase?: VtxoExitPhase
  exitState?: VtxoExitState
  claimAddress?: string
  lockLabel?: string
}

export function VtxoDetailDialog({
  vtxo,
  open,
  onOpenChange,
  formatSats,
  formatFiat,
  tipHeight,
  exitPhase,
  exitState,
  claimAddress,
  lockLabel
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
            claimAddress={claimAddress}
            exitPhase={exitPhase}
            exitState={exitState}
            formatFiat={formatFiat}
            formatSats={formatSats}
            lockLabel={lockLabel}
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
  exitState?: VtxoExitState
  claimAddress?: string
  lockLabel?: string
}

function VtxoDetailContent({
  vtxo,
  formatSats,
  formatFiat,
  tipHeight,
  exitPhase,
  exitState,
  claimAddress,
  lockLabel
}: VtxoDetailContentProps) {
  const { t } = useTranslation()
  const { copy, isCopied } = useCopyToClipboard()
  const [isEditAddressOpen, setIsEditAddressOpen] = useState(false)
  const hasClaimAddress = claimAddress !== undefined && claimAddress.length > 0
  const canEditClaimAddress =
    exitPhase !== undefined && isClaimAddressEditable(exitPhase, hasClaimAddress)
  const expiryTime = getExpiryTimeLabel(vtxo.expiryHeight, t, tipHeight)
  const expiryValue =
    expiryTime === '' ? String(vtxo.expiryHeight) : `${vtxo.expiryHeight} · ${expiryTime}`
  const lockedActionId = vtxo.state.type === 'locked' ? vtxo.state.actionId : undefined
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
            {exitState === undefined ? (
              <VtxoStatusBadge label={lockLabel} status={vtxo.state.type} />
            ) : (
              <VtxoExitBadge phase={exitPhase} state={exitState} />
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
          {exitPhase === undefined ? null : (
            <ClaimAddressRow
              address={claimAddress}
              emptyLabel={t('vtxos.detail.no_claim_address')}
              label={t('vtxos.detail.claim_address')}
              onEdit={canEditClaimAddress ? () => setIsEditAddressOpen(true) : undefined}
            />
          )}
          {lockedActionId === undefined ? null : (
            <DetailRow label={t('vtxos.detail.locked_action')} value={lockedActionId} />
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
      {canEditClaimAddress ? (
        <EditExitClaimAddressDialog
          onOpenChange={setIsEditAddressOpen}
          open={isEditAddressOpen}
          vtxoId={vtxo.id}
        />
      ) : null}
    </>
  )
}
