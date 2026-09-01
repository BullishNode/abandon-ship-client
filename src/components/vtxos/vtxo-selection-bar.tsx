import { ArrowLineDownIcon, ArrowsClockwiseIcon, XIcon } from '@phosphor-icons/react'
import { AnimatePresence, m } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { SignOutIcon } from '@/components/icons/sign-out'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

interface VtxoSelectionBarProps {
  count: number
  onRefresh: () => void
  onOffboard: () => void
  onEmergencyExit: () => void
  onDeselect: () => void
  isBusy?: boolean
  isRefreshDisabled?: boolean
}

export function VtxoSelectionBar({
  count,
  onRefresh,
  onOffboard,
  onEmergencyExit,
  onDeselect,
  isBusy,
  isRefreshDisabled
}: VtxoSelectionBarProps) {
  const { t } = useTranslation()
  const divider = (
    <Separator
      className="data-[orientation=vertical]:h-5 data-[orientation=vertical]:self-center"
      orientation="vertical"
    />
  )
  return (
    <AnimatePresence>
      {count > 0 && (
        <m.div
          animate={{ opacity: 1, y: 0 }}
          className="-translate-x-1/2 fixed bottom-6 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-fit"
          exit={{ opacity: 0, y: 20 }}
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.15 }}
        >
          <div className="flex flex-nowrap items-center justify-center gap-2 rounded-xl border border-border bg-background py-1.5 pr-1.5 pl-4 shadow-lg">
            <span className="whitespace-nowrap font-medium text-sm">
              {t('vtxos.selection.count', { count })}
            </span>
            {divider}
            <Button
              aria-label={t('vtxos.selection.refresh')}
              className="group"
              disabled={isBusy === true || isRefreshDisabled === true}
              onClick={onRefresh}
              size="sm"
              type="button"
              variant="ghost"
            >
              <ArrowsClockwiseIcon className="transition-transform duration-200 ease-out group-hover:rotate-30" />
              <span className="hidden sm:inline">{t('vtxos.selection.refresh')}</span>
            </Button>
            {divider}
            <Button
              aria-label={t('vtxos.selection.offboard')}
              className="group"
              disabled={isBusy}
              onClick={onOffboard}
              size="sm"
              type="button"
              variant="ghost"
            >
              <ArrowLineDownIcon className="transition-transform duration-200 ease-out group-hover:translate-y-0.5" />
              <span className="hidden sm:inline">{t('vtxos.selection.offboard')}</span>
            </Button>
            {divider}
            <Button
              aria-label={t('vtxos.selection.emergency_exit')}
              className="group text-destructive hover:text-destructive"
              disabled={isBusy}
              onClick={onEmergencyExit}
              size="sm"
              type="button"
              variant="ghost"
            >
              <SignOutIcon arrowClassName="transition-transform duration-200 ease-out group-hover:translate-x-1" />
              <span className="hidden sm:inline">{t('vtxos.selection.emergency_exit')}</span>
            </Button>
            {divider}
            <Button
              aria-label={t('vtxos.selection.deselect')}
              onClick={onDeselect}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <XIcon />
            </Button>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  )
}
