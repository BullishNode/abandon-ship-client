import { ArrowSquareOutIcon } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmergencyExitStartDialog } from '@/components/emergency-exit-start-dialog'
import { ExitProgressCard } from '@/components/exit-progress'
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
import { externalLinks } from '@/config/links'
import { WALLET_NAME_MAX_LENGTH } from '@/constants/wallet'
import { useClaimEmergencyExit } from '@/hooks/barkd/use-claim-emergency-exit'
import { useExitStatus } from '@/hooks/barkd/use-exit-status'
import { useOnchainAddress } from '@/hooks/barkd/use-onchain-address'
import { useOnchainBalance } from '@/hooks/barkd/use-onchain-balance'
import { useOnchainFeeRates } from '@/hooks/barkd/use-onchain-fee-rates'
import { useResetWallet } from '@/hooks/barkd/use-reset-wallet'
import { useStartEmergencyExit } from '@/hooks/barkd/use-start-emergency-exit'
import { useVtxos } from '@/hooks/barkd/use-vtxos'
import { useDownloadBackup } from '@/hooks/use-download-backup'
import { useSettingsStore } from '@/stores/settings'
import { useWalletStore } from '@/stores/wallet'
import type { BitcoinUnit } from '@/types/bitcoin'
import type { FiatCurrency, PriceProviderId } from '@/types/price-providers'
import { estimateEmergencyExitFeeSat, summarizeExits } from '@/utils/exit-progress'

const BITCOIN_UNITS: { value: BitcoinUnit; label: string }[] = [
  { label: 'Sats', value: 'sats' },
  { label: 'Bitcoin', value: 'btc' }
]

const PRICE_PROVIDERS: { value: PriceProviderId; label: string }[] = [
  { label: 'Binance', value: 'binance' },
  { label: 'CoinGecko', value: 'coingecko' },
  { label: 'Kraken', value: 'kraken' }
]

const FIAT_CURRENCIES: { value: FiatCurrency; label: string }[] = [
  { label: 'USD', value: 'usd' },
  { label: 'EUR', value: 'eur' }
]

type ExitDialogMode = 'start' | 'edit'

const AUTO_CLAIM_THROTTLE_MS = 30_000

export default function SettingsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [
    bitcoinUnit,
    setBitcoinUnit,
    priceProvider,
    setPriceProvider,
    fiatCurrency,
    setFiatCurrency,
    discreteMode,
    setDiscreteMode
  ] = useSettingsStore(
    useShallow((state) => [
      state.bitcoinUnit,
      state.setBitcoinUnit,
      state.priceProvider,
      state.setPriceProvider,
      state.fiatCurrency,
      state.setFiatCurrency,
      state.discreteMode,
      state.setDiscreteMode
    ])
  )
  const [wallet, updateWalletName, pendingExitClaimAddress, setPendingExitClaimAddress] =
    useWalletStore(
      useShallow((state) => [
        state.wallet,
        state.updateWalletName,
        state.pendingExitClaimAddress,
        state.setPendingExitClaimAddress
      ])
    )

  const [walletName, setWalletName] = useState(wallet?.name ?? '')
  const [isDeleteOpen, setDeleteOpen] = useState(false)
  const [isBackupOpen, setBackupOpen] = useState(false)
  const [isExitDialogOpen, setExitDialogOpen] = useState(false)
  const [exitDialogMode, setExitDialogMode] = useState<ExitDialogMode>('start')
  const [draftExitAddress, setDraftExitAddress] = useState('')
  const [claimAddressDismissed, setClaimAddressDismissed] = useState(false)
  const lastAutoClaimRef = useRef<{ claimableCount: number; attemptedAt: number }>({
    attemptedAt: 0,
    claimableCount: 0
  })

  const { mutate: downloadBackup, isPending: isDownloadingBackup } = useDownloadBackup({
    onSuccess: () => {
      setBackupOpen(false)
    }
  })

  const { data: exitStatuses } = useExitStatus()
  const { data: onchainBalance } = useOnchainBalance()
  const { data: vtxos } = useVtxos()
  const { data: feeRates } = useOnchainFeeRates()
  const summary = summarizeExits(exitStatuses ?? [])
  const feeRateSatPerVb = feeRates?.regularSatPerVb ?? 0
  const estimatedFeeSat = estimateEmergencyExitFeeSat(vtxos ?? [], feeRateSatPerVb)

  const { mutate: resetWallet, isPending: isDeleting } = useResetWallet({
    onSuccess: () => {
      setDeleteOpen(false)
      void navigate('/')
    }
  })
  const { mutate: fetchOnchainAddress, isPending: isFetchingWalletAddress } = useOnchainAddress()
  const {
    mutate: startEmergencyExit,
    isPending: isStartingExit,
    error: startExitError
  } = useStartEmergencyExit({
    onSuccess: () => {
      setExitDialogOpen(false)
    }
  })
  const { mutate: claimEmergencyExit, isPending: isClaimingExit } = useClaimEmergencyExit()

  const onchainSpendable = onchainBalance?.trustedSpendableSat ?? 0
  const hasNoVtxos = (vtxos?.length ?? 0) === 0

  const shouldShowProgress = summary.total > 0 && !summary.isDone

  const disableStartButton = summary.inProgress || isStartingExit || hasNoVtxos

  const feeEstimate =
    vtxos && vtxos.length > 0 && feeRateSatPerVb > 0
      ? {
          estimatedFeeSat,
          feeRateSatPerVb,
          onchainSat: onchainSpendable,
          vtxoCount: vtxos.length
        }
      : undefined

  function commitWalletName() {
    const trimmed = walletName.trim()
    if (trimmed.length === 0 || !wallet) {
      setWalletName(wallet?.name ?? '')
      return
    }
    updateWalletName(trimmed)
    setWalletName(trimmed)
  }

  function openExitDialog(mode: ExitDialogMode) {
    setExitDialogMode(mode)
    if (mode === 'start' && summary.isDone) {
      setPendingExitClaimAddress(null)
      setDraftExitAddress('')
    } else {
      setDraftExitAddress(pendingExitClaimAddress ?? '')
    }
    setExitDialogOpen(true)
  }

  function handleUseWalletAddress() {
    fetchOnchainAddress(undefined, {
      onSuccess: (address) => {
        setDraftExitAddress(address)
      }
    })
  }

  function handleSubmitExitAddress(address: string) {
    setPendingExitClaimAddress(address)
    setClaimAddressDismissed(false)
    if (exitDialogMode === 'start') {
      startEmergencyExit()
      return
    }
    setExitDialogOpen(false)
  }

  function handleExitDialogOpenChange(nextOpen: boolean) {
    if (!nextOpen && exitDialogMode === 'edit' && summary.claimable > 0) {
      const hasAddress = pendingExitClaimAddress !== null && pendingExitClaimAddress.length > 0
      if (!hasAddress) {
        setClaimAddressDismissed(true)
      }
    }
    setExitDialogOpen(nextOpen)
  }

  const hasClaimAddress = pendingExitClaimAddress !== null && pendingExitClaimAddress.length > 0
  const stillRipeningCount =
    summary.counts.start + summary.counts.processing + summary.counts['awaiting-delta']
  const allRipe = stillRipeningCount === 0
  const needsClaimAddress = allRipe && summary.claimable > 0 && !hasClaimAddress

  useEffect(() => {
    if (!allRipe || summary.claimable === 0 || !hasClaimAddress || isClaimingExit) {
      return
    }
    const now = Date.now()
    const last = lastAutoClaimRef.current
    if (
      last.claimableCount === summary.claimable &&
      now - last.attemptedAt < AUTO_CLAIM_THROTTLE_MS
    ) {
      return
    }
    lastAutoClaimRef.current = { attemptedAt: now, claimableCount: summary.claimable }
    if (pendingExitClaimAddress !== null) {
      claimEmergencyExit({ destination: pendingExitClaimAddress })
    }
  }, [
    allRipe,
    summary.claimable,
    hasClaimAddress,
    pendingExitClaimAddress,
    isClaimingExit,
    claimEmergencyExit
  ])

  useEffect(() => {
    if (!needsClaimAddress || claimAddressDismissed || isExitDialogOpen) {
      return
    }
    setExitDialogMode('edit')
    setDraftExitAddress('')
    setExitDialogOpen(true)
  }, [needsClaimAddress, claimAddressDismissed, isExitDialogOpen])

  const startButtonLabel = summary.inProgress
    ? t('settings.danger.emergency_exit.in_progress_button')
    : t('settings.danger.emergency_exit.button')

  const emergencyExitDescription =
    !shouldShowProgress && hasNoVtxos
      ? t('settings.danger.emergency_exit.no_vtxos')
      : t('settings.danger.emergency_exit.description')

  return (
    <div className="mx-auto @container/field-group max-w-2xl space-y-8">
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
      <Field>
        <FieldLabel htmlFor="price-provider">{t('settings.price_provider.label')}</FieldLabel>
        <Select onValueChange={setPriceProvider} value={priceProvider}>
          <SelectTrigger id="price-provider">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRICE_PROVIDERS.map((provider) => (
              <SelectItem key={provider.value} value={provider.value}>
                {provider.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor="fiat-currency">{t('settings.fiat_currency.label')}</FieldLabel>
        <Select onValueChange={setFiatCurrency} value={fiatCurrency}>
          <SelectTrigger id="fiat-currency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FIAT_CURRENCIES.map((currency) => (
              <SelectItem key={currency.value} value={currency.value}>
                {currency.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldDescription>{t('settings.fiat_currency.description')}</FieldDescription>
      </Field>
      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor="discrete-mode">{t('settings.discrete_mode.label')}</FieldLabel>
          <FieldDescription>{t('settings.discrete_mode.description')}</FieldDescription>
        </FieldContent>
        <Switch checked={discreteMode} id="discrete-mode" onCheckedChange={setDiscreteMode} />
      </Field>
      <Field orientation="responsive">
        <FieldContent>
          <FieldLabel>{t('settings.backup.label')}</FieldLabel>
          <FieldDescription>{t('settings.backup.description')}</FieldDescription>
        </FieldContent>
        <Button onClick={() => setBackupOpen(true)} variant="outline">
          {t('settings.backup.button')}
        </Button>
      </Field>
      <Field orientation="responsive">
        <FieldContent>
          <FieldLabel>{t('settings.community_forum.label')}</FieldLabel>
          <FieldDescription>{t('settings.community_forum.description')}</FieldDescription>
        </FieldContent>
        <Button asChild variant="outline">
          <a href={externalLinks.forum} rel="noopener noreferrer" target="_blank">
            {t('settings.community_forum.button')}
            <ArrowSquareOutIcon />
          </a>
        </Button>
      </Field>
      <Field orientation="responsive">
        <FieldContent>
          <FieldLabel>{t('settings.community_chat.label')}</FieldLabel>
          <FieldDescription>{t('settings.community_chat.description')}</FieldDescription>
        </FieldContent>
        <Button asChild variant="outline">
          <a href={externalLinks.chat} rel="noopener noreferrer" target="_blank">
            {t('settings.community_chat.button')}
            <ArrowSquareOutIcon />
          </a>
        </Button>
      </Field>
      <Field orientation="responsive">
        <FieldContent>
          <FieldLabel>{t('settings.report_issues.label')}</FieldLabel>
          <FieldDescription>{t('settings.report_issues.description')}</FieldDescription>
        </FieldContent>
        <Button asChild variant="outline">
          <a href={externalLinks.reportIssues} rel="noopener noreferrer" target="_blank">
            {t('settings.report_issues.button')}
            <ArrowSquareOutIcon />
          </a>
        </Button>
      </Field>
      <section className="space-y-4 rounded-lg border border-destructive/30 p-4">
        <h2 className="font-semibold text-destructive text-lg">{t('settings.danger.title')}</h2>
        <Field className="gap-4" orientation="responsive">
          <FieldContent>
            <FieldLabel>{t('settings.danger.emergency_exit.label')}</FieldLabel>
            <FieldDescription>{emergencyExitDescription}</FieldDescription>
          </FieldContent>
          <Button
            disabled={disableStartButton}
            onClick={() => openExitDialog('start')}
            variant="destructive"
          >
            {startButtonLabel}
          </Button>
        </Field>
        {shouldShowProgress ? (
          <ExitProgressCard
            destinationAddress={pendingExitClaimAddress}
            needsClaimAddress={needsClaimAddress}
            onChangeAddress={() => openExitDialog('edit')}
            summary={summary}
          />
        ) : null}
        <Field className="gap-4" orientation="responsive">
          <FieldContent>
            <FieldLabel>{t('settings.danger.delete_wallet.label')}</FieldLabel>
            <FieldDescription>{t('settings.danger.delete_wallet.description')}</FieldDescription>
          </FieldContent>
          <Button onClick={() => setDeleteOpen(true)} variant="destructive">
            {t('settings.danger.delete_wallet.button')}
          </Button>
        </Field>
      </section>
      <EmergencyExitStartDialog
        address={draftExitAddress}
        errorMessage={startExitError?.message}
        feeEstimate={feeEstimate}
        isFetchingWalletAddress={isFetchingWalletAddress}
        isSubmitting={isStartingExit}
        mode={exitDialogMode}
        onAddressChange={setDraftExitAddress}
        onOpenChange={handleExitDialogOpenChange}
        onSubmit={handleSubmitExitAddress}
        onUseWalletAddress={handleUseWalletAddress}
        open={isExitDialogOpen}
      />
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
      <ConfirmDialog
        confirmLabel={t('settings.backup.confirm.button')}
        description={t('settings.backup.confirm.description')}
        loading={isDownloadingBackup}
        onConfirm={() => downloadBackup()}
        onOpenChange={(open) => {
          if (!isDownloadingBackup) {
            setBackupOpen(open)
          }
        }}
        open={isBackupOpen}
        title={t('settings.backup.confirm.title')}
      />
    </div>
  )
}
