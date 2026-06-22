import { ArrowsClockwiseIcon, XIcon } from '@phosphor-icons/react'
import { AnimatePresence, m } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { SignOutIcon } from '@/components/icons/sign-out'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

interface VtxoSelectionBarProps {
  count: number
  onRefresh: () => void
  onOffboard: () => void
  onDeselect: () => void
  isBusy?: boolean
}

export function VtxoSelectionBar({
  count,
  onRefresh,
  onOffboard,
  onDeselect,
  isBusy
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
          className="-translate-x-1/2 fixed bottom-6 left-1/2 z-50"
          exit={{ opacity: 0, y: 20 }}
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.15 }}
        >
          <div className="flex items-center gap-2 rounded-xl border border-border bg-background py-1.5 pr-1.5 pl-4 shadow-lg">
            <span className="whitespace-nowrap font-medium text-sm">
              {t('vtxos.selection.count', { count })}
            </span>
            {divider}
            <Button
              className="group"
              disabled={isBusy}
              onClick={onRefresh}
              size="sm"
              type="button"
              variant="ghost"
            >
              <ArrowsClockwiseIcon className="transition-transform duration-200 ease-out group-hover:rotate-30" />
              {t('vtxos.selection.refresh')}
            </Button>
            {divider}
            <Button
              className="group"
              disabled={isBusy}
              onClick={onOffboard}
              size="sm"
              type="button"
              variant="ghost"
            >
              <SignOutIcon arrowClassName="transition-transform duration-200 ease-out group-hover:translate-x-6" />
              {t('vtxos.selection.offboard')}
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
