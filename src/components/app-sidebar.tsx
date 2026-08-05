import { GearIcon, SquaresFourIcon } from '@phosphor-icons/react'
import { VtxoIcon } from '@/components/icons/vtxo'
import { useTranslation } from 'react-i18next'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from '@/components/ui/sidebar'
import { config } from '@/config/runtime'
import { useWalletStore } from '@/stores/wallet'
import { MarbleAvatar } from './marble-avatar'
import { NavGroup } from './nav-group'
import type { NavGroupProps } from './nav-group'

const FALLBACK_WALLET_NAME = 'My Wallet'

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { t } = useTranslation()
  const wallet = useWalletStore((state) => state.wallet)
  const walletName = wallet?.name ?? FALLBACK_WALLET_NAME
  const navMainItems: NavGroupProps['items'] = [
    {
      icon: SquaresFourIcon,
      name: t('nav.transactions'),
      url: '/dashboard'
    },
    {
      icon: VtxoIcon,
      name: t('nav.vtxos'),
      url: '/dashboard/vtxos'
    },
    {
      icon: GearIcon,
      name: t('nav.settings'),
      url: '/dashboard/settings'
    }
  ]
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="cursor-default hover:bg-transparent hover:text-sidebar-foreground active:bg-transparent active:text-sidebar-foreground"
              size="lg"
            >
              <div className="flex aspect-square size-8 items-center justify-center overflow-hidden rounded-lg">
                <MarbleAvatar
                  className="size-full!"
                  name={walletName}
                  seed={wallet?.fingerprint}
                  variant="square"
                />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{walletName}</span>
                <span className="truncate text-xs">{t(`network.${config.network}`)}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavGroup items={navMainItems} label={t('nav.wallet', { count: 1 })} />
      </SidebarContent>
    </Sidebar>
  )
}
