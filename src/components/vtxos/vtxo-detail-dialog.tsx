import { CheckIcon, CopyIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CopyableValueRow, DetailRow } from '@/components/movement-detail-shared'
import { ClaimAddressRow } from '@/components/vtxos/claim-address-row'
import { EditExitClaimAddressDialog } from '@/components/vtxos/edit-exit-claim-address-dialog'
import { VtxoExitBadge } from '@/components/vtxos/vtxo-exit-badge'
import { VtxoRefreshBadge } from '@/components/vtxos/vtxo-refresh-badge'
import { VtxoStatusBadge } from '@/components/vtxos/vtxo-status-badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { useVtxoEncoded } from '@/hooks/barkd/use-vtxo-encoded'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { useLocale } from '@/hooks/use-locale'
import type { RefreshPhase } from '@/types/domain/round'
import type { Vtxo } from '@/types/domain/vtxo'
import type { VtxoExitPhase, VtxoExitState, VtxoPayoutState, VtxoStatus } from '@/utils/vtxo'
import {
  getExpiryTimeLabel,
  getVtxoRawJson,
  getVtxoStatus,
  isClaimAddressEditable,
  truncateVtxoId
} from '@/utils/vtxo'

interface VtxoDetailDialogProps {
  vtxo: Vtxo | null
  open: boolean
  onOpenChange: (open: boolean) => void
  formatSats: (sats: number) => string
  formatFiat: (sats: number) => string
  tipHeight?: number
  exitPhase?: VtxoExitPhase
  exitState?: VtxoExitState
  claimAddress?: string
  lockLabel?: string
  refreshPhase?: RefreshPhase
  payoutState?: VtxoPayoutState
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
  lockLabel,
  refreshPhase,
  payoutState
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
            payoutState={payoutState}
            refreshPhase={refreshPhase}
            tipHeight={tipHeight}
            vtxo={vtxo}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

interface VtxoDetailBadgeProps {
  status: VtxoStatus
  exitPhase?: VtxoExitPhase
  exitState?: VtxoExitState
  lockLabel?: string
  refreshPhase?: RefreshPhase
}

function VtxoDetailBadge({
  status,
  exitPhase,
  exitState,
  lockLabel,
  refreshPhase
}: VtxoDetailBadgeProps) {
  if (exitState !== undefined) {
    return <VtxoExitBadge phase={exitPhase} state={exitState} />
  }
  if (refreshPhase !== undefined) {
    return <VtxoRefreshBadge phase={refreshPhase} />
  }
  return <VtxoStatusBadge label={lockLabel} status={status} />
}

interface VtxoDetailContentProps {
  vtxo: Vtxo
  formatSats: (sats: number) => string
  formatFiat: (sats: number) => string
  tipHeight?: number
  exitPhase?: VtxoExitPhase
  exitState?: VtxoExitState
  claimAddress?: string
  lockLabel?: string
  refreshPhase?: RefreshPhase
  payoutState?: VtxoPayoutState
}

function VtxoDetailContent({
  vtxo,
  formatSats,
  formatFiat,
  tipHeight,
  exitPhase,
  exitState,
  claimAddress,
  lockLabel,
  refreshPhase,
  payoutState
}: VtxoDetailContentProps) {
  const { t } = useTranslation()
  const locale = useLocale()
  const { copy, isCopied } = useCopyToClipboard()
  const { copy: copyHex, isCopied: isHexCopied } = useCopyToClipboard()
  const { data: encodedVtxo } = useVtxoEncoded(vtxo.id)
  const [isEditAddressOpen, setIsEditAddressOpen] = useState(false)
  const hasClaimAddress = claimAddress !== undefined && claimAddress.length > 0
  const canEditClaimAddress =
    exitPhase !== undefined && isClaimAddressEditable(exitPhase, hasClaimAddress)
  const expiryTime = getExpiryTimeLabel(vtxo.expiryHeight, t, locale, tipHeight)
  const expiryValue =
    expiryTime === '' ? String(vtxo.expiryHeight) : `${vtxo.expiryHeight} · ${expiryTime}`
  const lockedActionId = vtxo.state.type === 'locked' ? vtxo.state.actionId : undefined
  const payout = payoutState?.payoutById.get(vtxo.id)
  const exitDepthValue =
    vtxo.exitDepth === undefined || vtxo.exitDepth === null ? '—' : String(vtxo.exitDepth)

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('vtxos.detail.title')}</DialogTitle>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-5">
        <div className="flex flex-col divide-y divide-border *:py-3 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col leading-tight">
              <span className="font-semibold text-2xl tabular-nums">
                {formatSats(vtxo.amountSats)}
              </span>
              <span className="text-muted-foreground text-sm tabular-nums">
                {formatFiat(vtxo.amountSats)}
              </span>
            </div>
            <VtxoDetailBadge
              exitPhase={exitPhase}
              exitState={exitState}
              lockLabel={lockLabel}
              refreshPhase={refreshPhase}
              status={getVtxoStatus(vtxo, tipHeight, payoutState)}
            />
          </div>
          {vtxo.policyType === undefined ? null : (
            <DetailRow
              label={t('vtxos.detail.policy_type')}
              tooltip={t('vtxos.detail.policy_tooltip')}
              value={vtxo.policyType}
            />
          )}
          <DetailRow label={t('vtxos.detail.expiry')} value={expiryValue} />
          {vtxo.exitDelta === undefined ? null : (
            <DetailRow
              label={t('vtxos.detail.exit_delta')}
              tooltip={t('vtxos.detail.exit_delta_tooltip')}
              value={t('vtxos.detail.blocks_value', { count: vtxo.exitDelta })}
            />
          )}
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
          {vtxo.chainAnchor === undefined ? null : (
            <CopyableValueRow
              displayValue={truncateVtxoId(vtxo.chainAnchor)}
              label={t('vtxos.detail.chain_anchor')}
              value={vtxo.chainAnchor}
            />
          )}
          {exitPhase === undefined ? null : (
            <ClaimAddressRow
              address={claimAddress}
              emptyLabel={t('vtxos.detail.no_claim_address')}
              label={t('vtxos.detail.claim_address')}
              onEdit={canEditClaimAddress ? () => setIsEditAddressOpen(true) : undefined}
            />
          )}
          {payout === undefined ? null : (
            <CopyableValueRow
              displayValue={truncateVtxoId(`${payout.txid}:${payout.vout}`)}
              label={t('vtxos.detail.payout')}
              value={`${payout.txid}:${payout.vout}`}
            />
          )}
          {lockedActionId === undefined ? null : (
            <DetailRow label={t('vtxos.detail.locked_action')} value={lockedActionId} />
          )}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
          <Button
            className="w-full"
            disabled={encodedVtxo === undefined}
            onClick={() => {
              if (encodedVtxo !== undefined) {
                void copyHex(encodedVtxo)
              }
            }}
            type="button"
            variant="outline"
          >
            {isHexCopied ? <CheckIcon /> : <CopyIcon />}
            {isHexCopied ? t('vtxos.detail.copied') : t('vtxos.detail.copy_raw_hex')}
          </Button>
        </div>
      </DialogBody>
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
