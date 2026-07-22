import { PaperPlaneTiltIcon, QrCodeIcon, ScanIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { Outlet, useLocation } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { AppSidebar } from '@/components/app-sidebar'
import { BoardModal } from '@/components/board-modal'
import { ReceiveModal } from '@/components/receive-modal'
import { SendModal } from '@/components/send-modal'
import { WalletActionsPopover } from '@/components/wallet-actions-popover'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { useAutoClaimEmergencyExit } from '@/hooks/barkd/use-auto-claim-emergency-exit'
import { useAutoRefresh } from '@/hooks/barkd/use-auto-refresh'
import { useMovementSync } from '@/hooks/barkd/use-movement-sync'
import { useRefreshOnReceive } from '@/hooks/barkd/use-refresh-on-receive'
import { useModalsStore } from '@/stores/modals'
import { canUseCamera } from '@/utils/camera'

const ROUTE_TITLE_KEYS: Record<string, string> = {
  '/dashboard': 'nav.transactions',
  '/dashboard/settings': 'nav.settings',
  '/dashboard/vtxos': 'nav.vtxos'
}

export default function DashboardLayout() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const [
    sendOpen,
    sendInitialStep,
    receiveOpen,
    boardOpen,
    openSend,
    setSendOpen,
    openReceive,
    setReceiveOpen,
    setBoardOpen
  ] = useModalsStore(
    useShallow((state) => [
      state.sendOpen,
      state.sendInitialStep,
      state.receiveOpen,
      state.boardOpen,
      state.openSend,
      state.setSendOpen,
      state.openReceive,
      state.setReceiveOpen,
      state.setBoardOpen
    ])
  )
  useMovementSync()
  useAutoClaimEmergencyExit()
  useAutoRefresh()
  useRefreshOnReceive()

  const routeTitleKey = ROUTE_TITLE_KEYS[pathname]
  const routeTitle = routeTitleKey ? t(routeTitleKey) : ''
  const scanSupported = canUseCamera()

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex min-w-0 items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              className="mt-2 mr-2 data-[orientation=vertical]:h-4"
              orientation="vertical"
            />
            <h3 className="truncate">{routeTitle}</h3>
          </div>
          <ul className="flex shrink-0 gap-2 pr-4">
            {scanSupported && (
              <li>
                <Button
                  aria-label={t('actions.scan')}
                  onClick={() => openSend('scan')}
                  variant="outline"
                >
                  <ScanIcon />
                  <span className="hidden md:inline">{t('actions.scan')}</span>
                </Button>
              </li>
            )}
            <li>
              <Button aria-label={t('actions.send')} onClick={() => openSend('send')}>
                <PaperPlaneTiltIcon />
                <span className="hidden md:inline">{t('actions.send')}</span>
              </Button>
            </li>
            <li>
              <Button aria-label={t('actions.receive')} onClick={openReceive}>
                <QrCodeIcon />
                <span className="hidden md:inline">{t('actions.receive')}</span>
              </Button>
            </li>
            <li>
              <WalletActionsPopover />
            </li>
          </ul>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
        <ReceiveModal onOpenChange={setReceiveOpen} open={receiveOpen} />
        <SendModal initialStep={sendInitialStep} onOpenChange={setSendOpen} open={sendOpen} />
        <BoardModal onOpenChange={setBoardOpen} open={boardOpen} />
      </SidebarInset>
    </SidebarProvider>
  )
}
