import { QrCodeIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { AmountUnitToggle } from '@/components/amount-unit-toggle'
import {
  Modal,
  ModalBody,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle
} from '@/components/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useBoardFlow } from '@/hooks/use-board-flow'
import { useFormatBitcoin } from '@/hooks/use-format-bitcoin'
import { useFormatFiat } from '@/hooks/use-format-fiat'
import { cn } from '@/lib/utils'
import { useModalsStore } from '@/stores/modals'

interface BoardModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BoardModal({ open, onOpenChange }: BoardModalProps) {
  const { t } = useTranslation()
  const formatBitcoin = useFormatBitcoin()
  const formatFiat = useFormatFiat()
  const openReceive = useModalsStore((state) => state.openReceive)
  const flow = useBoardFlow({ onOpenChange, open })
  const hasAmountError =
    flow.validation === 'insufficient_funds' ||
    flow.validation === 'below_min' ||
    flow.validation === 'below_dust'

  function handleReceiveOnchain() {
    onOpenChange(false)
    openReceive()
  }

  return (
    <Modal setShowModal={onOpenChange} showModal={open}>
      <div className="flex min-h-0 flex-1 flex-col gap-6">
        <ModalHeader>
          <ModalTitle>{t('board.title')}</ModalTitle>
          <ModalDescription>{t('board.description')}</ModalDescription>
        </ModalHeader>
        <ModalBody className="flex flex-col gap-4">
          {flow.hasOnchainFunds ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="board-amount">{t('board.amount')}</Label>
                {flow.secondaryDisplay !== '' && (
                  <span className="text-muted-foreground text-xs leading-none">
                    {flow.secondaryDisplay}
                  </span>
                )}
              </div>
              <Input
                aria-invalid={hasAmountError}
                className={cn(
                  hasAmountError && 'border-destructive focus-visible:ring-destructive'
                )}
                endAddOn={
                  <span className="flex items-center gap-2">
                    <Button onClick={flow.setMax} size="xs" type="button" variant="ghost">
                      {t('board.max')}
                    </Button>
                    <AmountUnitToggle
                      canToggle={flow.canUseFiat}
                      entryMode={flow.entryMode}
                      onToggle={flow.toggleAmountMode}
                      unitLabel={flow.unitLabel}
                    />
                  </span>
                }
                id="board-amount"
                onChange={(e) => flow.setAmount(e.target.value)}
                placeholder="0"
                type="text"
                value={flow.amountDisplay}
              />
              {flow.validation === 'insufficient_funds' && (
                <p className="text-destructive text-xs">
                  {t('board.errors.insufficient_funds', {
                    balance: formatBitcoin(flow.onchainSpendableSat)
                  })}
                </p>
              )}
              {flow.validation === 'below_min' && flow.minBoardAmountSat !== undefined && (
                <p className="text-destructive text-xs">
                  {t('board.errors.below_min', {
                    amount: formatBitcoin(flow.minBoardAmountSat)
                  })}
                </p>
              )}
              {flow.validation === 'below_dust' && (
                <p className="text-destructive text-xs">{t('board.errors.below_dust')}</p>
              )}
              <span className="text-muted-foreground text-xs leading-none">
                {t('board.available', { balance: formatBitcoin(flow.onchainSpendableSat) })}
              </span>
              {flow.minBoardAmountSat !== undefined && flow.minBoardAmountSat > 0 && (
                <span className="text-muted-foreground text-xs leading-none">
                  {t('board.minimum', { amount: formatBitcoin(flow.minBoardAmountSat) })}
                </span>
              )}
              {(flow.feeSat !== undefined || flow.isFetchingFee) && (
                <span className="text-muted-foreground text-xs leading-none">
                  {t('board.fee_estimate')}:{' '}
                  {flow.feeSat === undefined ? '…' : formatBitcoin(flow.feeSat)}
                  {flow.feeSat !== undefined && flow.feeSat > 0 && (
                    <> • {formatFiat(flow.feeSat)}</>
                  )}
                </span>
              )}
              <span className="text-muted-foreground text-xs">{t('board.onchain_fee_note')}</span>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">{t('board.no_onchain.description')}</p>
          )}
        </ModalBody>
        <ModalFooter>
          {flow.hasOnchainFunds ? (
            <Button
              disabled={flow.validation !== 'valid'}
              loading={flow.isBoarding}
              onClick={flow.submit}
            >
              {t('board.confirm')}
            </Button>
          ) : (
            <Button onClick={handleReceiveOnchain}>
              <QrCodeIcon />
              {t('board.no_onchain.receive')}
            </Button>
          )}
        </ModalFooter>
      </div>
    </Modal>
  )
}
