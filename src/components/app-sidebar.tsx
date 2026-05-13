import { GearIcon, SquaresFourIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem
} from '@/components/ui/sidebar'
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
    }
  ]
  const navSecondaryItems: NavGroupProps['items'] = [
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
            <div className="flex items-center gap-2">
              <MarbleAvatar
                className="size-8 rounded-lg"
                name={walletName}
                seed={wallet?.fingerprint}
                variant="square"
              />
              <span className="truncate font-medium text-sm">{walletName}</span>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavGroup items={navMainItems} label={t('nav.wallet', { count: 1 })} />
        <NavGroup className="mt-auto" items={navSecondaryItems} />
      </SidebarContent>
    </Sidebar>
  )
}
