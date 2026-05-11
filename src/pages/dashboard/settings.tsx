import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Field, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { WALLET_NAME_MAX_LENGTH } from '@/constants/wallet'
import { useResetWallet } from '@/hooks/barkd/use-reset-wallet'
import { useSettingsStore } from '@/stores/settings'
import { useWalletStore } from '@/stores/wallet'
import type { BitcoinUnit } from '@/types/bitcoin'

const BITCOIN_UNITS: { value: BitcoinUnit; label: string }[] = [
  { label: 'Satoshi', value: 'sats' },
  { label: 'Bitcoin', value: 'btc' }
]

export default function SettingsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [bitcoinUnit, setBitcoinUnit] = useSettingsStore(
    useShallow((state) => [state.bitcoinUnit, state.setBitcoinUnit])
  )
  const [discreteMode, setDiscreteMode] = useSettingsStore(
    useShallow((state) => [state.discreteMode, state.setDiscreteMode])
  )
  const [wallet, updateWalletName] = useWalletStore(
    useShallow((state) => [state.wallet, state.updateWalletName])
  )
  const [walletName, setWalletName] = useState(wallet?.name ?? '')
  const [isDeleteOpen, setDeleteOpen] = useState(false)
  const { mutate: resetWallet, isPending: isDeleting } = useResetWallet({
    onSuccess: () => {
      setDeleteOpen(false)
      void navigate('/')
    }
  })

  function commitWalletName() {
    const trimmed = walletName.trim()
    if (trimmed.length === 0 || !wallet) {
      setWalletName(wallet?.name ?? '')
      return
    }
    updateWalletName(trimmed)
    setWalletName(trimmed)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="font-bold text-2xl">Settings</h1>
      <Field>
        <FieldLabel htmlFor="wallet-name">{t('settings.wallet_name.label')}</FieldLabel>
        <Input
          autoComplete="off"
          disabled={!wallet}
          id="wallet-name"
          maxLength={WALLET_NAME_MAX_LENGTH}
          onBlur={commitWalletName}
          onChange={(event) => setWalletName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur()
            }
          }}
          placeholder={t('wallet.name.placeholder')}
          value={walletName}
        />
        <FieldDescription>{t('settings.wallet_name.description')}</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="bitcoin-unit">Bitcoin unit</FieldLabel>
        <Select onValueChange={setBitcoinUnit} value={bitcoinUnit}>
          <SelectTrigger id="bitcoin-unit">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BITCOIN_UNITS.map((unit) => (
              <SelectItem key={unit.value} value={unit.value}>
                {unit.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor="discrete-mode">{t('settings.discrete_mode.label')}</FieldLabel>
          <FieldDescription>{t('settings.discrete_mode.description')}</FieldDescription>
        </FieldContent>
        <Switch checked={discreteMode} id="discrete-mode" onCheckedChange={setDiscreteMode} />
      </Field>
      <section className="space-y-4 rounded-lg border border-destructive/30 p-4">
        <h2 className="font-semibold text-destructive text-lg">{t('settings.danger.title')}</h2>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel>{t('settings.danger.delete_wallet.label')}</FieldLabel>
            <FieldDescription>{t('settings.danger.delete_wallet.description')}</FieldDescription>
          </FieldContent>
          <Button onClick={() => setDeleteOpen(true)} variant="destructive">
            {t('settings.danger.delete_wallet.button')}
          </Button>
        </Field>
      </section>
      <ConfirmDialog
        confirmLabel={t('actions.delete')}
        description={t('settings.danger.delete_wallet.confirm.description')}
        loading={isDeleting}
        onConfirm={() => resetWallet()}
        onOpenChange={(open) => {
          if (!isDeleting) {
            setDeleteOpen(open)
          }
        }}
        open={isDeleteOpen}
        title={t('settings.danger.delete_wallet.confirm.title')}
        variant="destructive"
      />
    </div>
  )
}
