import { CaretUpDownIcon, PlusIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import type { Wallet } from '@/types/wallet'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger
} from './ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar
} from './ui/sidebar'

interface NavWalletProps {
  selectedWalletId: Wallet['id']
  wallets: Wallet[]
}

export function NavWallet({ selectedWalletId, wallets }: NavWalletProps) {
  const { t } = useTranslation()
  const { isMobile } = useSidebar()

  const selectedWallet = wallets.find(
    (wallet) => wallet.id === selectedWalletId
  )

  if (!selectedWallet) {
    return null
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              size="lg"
            >
              <Avatar className="size-8 rounded-lg">
                <AvatarImage
                  alt={selectedWallet.name}
                  src="https://picsum.photos/200"
                />
                <AvatarFallback className="rounded-lg">CN</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {selectedWallet.name}
                </span>
              </div>
              <CaretUpDownIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              {t('nav.wallet', { count: 2 })}
            </DropdownMenuLabel>
            {wallets.map((wallet, index) => (
              <DropdownMenuItem className="gap-2 p-2" key={wallet.id}>
                <div className="flex size-6 items-center justify-center rounded-md border">
                  {index + 1}
                </div>
                {wallet.name}
                <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2">
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <PlusIcon className="size-4" />
              </div>
              <div className="font-medium text-muted-foreground">
                {t('wallet.add')}
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
