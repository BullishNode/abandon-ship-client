import {
  ArrowsClockwiseIcon,
  ArrowSquareOutIcon,
  DownloadSimpleIcon,
  WarningIcon
} from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmergencyExitStartDialog } from '@/components/emergency-exit-start-dialog'
import { ExitProgressCard } from '@/components/exit-progress'
import { SeedPhraseInput } from '@/components/seed-phrase-input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { config } from '@/config/barkd'
import { externalLinks } from '@/config/links'
import { WALLET_NAME_MAX_LENGTH } from '@/constants/wallet'
import { changeThemeWithTransition } from '@/lib/theme-transition'
import { useArkInfo } from '@/hooks/barkd/use-ark-info'
import { useExitStatus } from '@/hooks/barkd/use-exit-status'
import { useOnchainAddress } from '@/hooks/barkd/use-onchain-address'
import { useOnchainBalance } from '@/hooks/barkd/use-onchain-balance'
import { useOnchainFeeRates } from '@/hooks/barkd/use-onchain-fee-rates'
import { usePendingRounds } from '@/hooks/barkd/use-pending-rounds'
import { useRefreshAll } from '@/hooks/barkd/use-refresh-all'
import { useResetWallet } from '@/hooks/barkd/use-reset-wallet'
import { useStartEmergencyExit } from '@/hooks/barkd/use-start-emergency-exit'
import { useVtxos } from '@/hooks/barkd/use-vtxos'
import { useWalletMnemonic } from '@/hooks/use-wallet-mnemonic'
import { useSettingsStore } from '@/stores/settings'
import { useWalletStore } from '@/stores/wallet'
import type { BitcoinUnit } from '@/types/bitcoin'
import type { FiatCurrency, PriceProviderId } from '@/types/price-providers'
import type { Theme } from '@/types/theme'
import {
  estimateEmergencyExitFeeSat,
  hasUnaddressedClaimable,
  resolvePrimaryClaimAddress,
  summarizeExits
} from '@/utils/exit-progress'
import { downloadDebugLog } from '@/utils/logs'
import type { RefreshThresholdOption } from '@/utils/refresh'
import {
  getRefreshThresholdOptions,
  getThresholdLabelParts,
  isRoundInProgress,
  resolveThresholdBlocks
} from '@/utils/refresh'

const SEED_HIDDEN_PLACEHOLDER = Array.from({ length: 12 }, () =>
  '•'.repeat(4 + Math.floor(Math.random() * 5))
).join(' ')

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

const THEME_OPTIONS: Theme[] = ['light', 'dark', 'system']

type ExitDialogMode = 'start' | 'edit'

export default function SettingsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [
    theme,
    bitcoinUnit,
    setBitcoinUnit,
    priceProvider,
    setPriceProvider,
    fiatCurrency,
    setFiatCurrency,
    discreetMode,
    setDiscreetMode,
    autoRefreshThresholdBlocks,
    setAutoRefreshThresholdBlocks,
    refreshOnReceive,
    setRefreshOnReceive
  ] = useSettingsStore(
    useShallow((state) => [
      state.theme,
      state.bitcoinUnit,
      state.setBitcoinUnit,
      state.priceProvider,
      state.setPriceProvider,
      state.fiatCurrency,
      state.setFiatCurrency,
      state.discreetMode,
      state.setDiscreetMode,
      state.autoRefreshThresholdBlocks,
      state.setAutoRefreshThresholdBlocks,
      state.refreshOnReceive,
      state.setRefreshOnReceive
    ])
  )
  const [
    wallet,
    updateWalletName,
    exitClaimAddresses,
    setExitClaimAddresses,
    isEmergencyExitAllInProgress,
    setIsEmergencyExitAllInProgress
  ] = useWalletStore(
    useShallow((state) => [
      state.wallet,
      state.updateWalletName,
      state.exitClaimAddresses,
      state.setExitClaimAddresses,
      state.isEmergencyExitAllInProgress,
      state.setIsEmergencyExitAllInProgress
    ])
  )

  const [walletName, setWalletName] = useState(wallet?.name ?? '')
  const [isDeleteOpen, setDeleteOpen] = useState(false)
  const [isSeedRevealed, setSeedRevealed] = useState(false)
  const [isExitDialogOpen, setExitDialogOpen] = useState(false)
  const [exitDialogMode, setExitDialogMode] = useState<ExitDialogMode>('start')
  const [draftExitAddress, setDraftExitAddress] = useState('')
  const [claimAddressDismissed, setClaimAddressDismissed] = useState(false)
  const [isDownloadingLogs, setDownloadingLogs] = useState(false)

  async function handleDownloadLogs() {
    setDownloadingLogs(true)
    try {
      await downloadDebugLog()
    } catch {
      toast.error(t('settings.diagnostics.error'))
    } finally {
      setDownloadingLogs(false)
    }
  }

  const { data: mnemonic, isFetching: isFetchingMnemonic } = useWalletMnemonic(isSeedRevealed)

  function handleToggleSeed() {
    setSeedRevealed((value) => !value)
  }

  const { data: exitStatuses } = useExitStatus()
  const { data: onchainBalance } = useOnchainBalance()
  const { data: vtxos } = useVtxos()
  const { data: feeRates } = useOnchainFeeRates()
  const { data: pendingRounds } = usePendingRounds()
  const { data: arkInfo } = useArkInfo()
  const thresholdOptions = getRefreshThresholdOptions(
    arkInfo?.vtxoExpiryDelta,
    arkInfo?.fees.refresh
  )
  const selectedThresholdBlocks = resolveThresholdBlocks(
    autoRefreshThresholdBlocks,
    thresholdOptions
  )
  function formatThresholdOption(option: RefreshThresholdOption): string {
    const parts = getThresholdLabelParts(option)
    const time =
      parts.unit === 'days'
        ? t('settings.auto_refresh.threshold.days', { count: parts.count })
        : t('settings.auto_refresh.threshold.hours', { count: parts.count })
    const fee =
      parts.feePercent === 0
        ? t('settings.auto_refresh.threshold.free')
        : t('settings.auto_refresh.threshold.fee', { percent: parts.feePercent })
    return `${time} · ${fee}`
  }
  const { mutate: refreshAll, isPending: isRefreshing } = useRefreshAll({
    onError: () => {
      toast.error(t('settings.auto_refresh.manual.error'))
    },
    onSuccess: () => {
      toast.success(t('settings.auto_refresh.manual.started'))
    }
  })
  const isRoundActive = isRoundInProgress(pendingRounds)
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
  const onchainSpendable = onchainBalance?.trustedSpendableSat ?? 0
  const hasNoVtxos = (vtxos?.length ?? 0) === 0

  const allVtxoIds = (vtxos ?? []).map((vtxo) => vtxo.id)
  const exitingVtxoIds = (exitStatuses ?? []).map((exit) => exit.vtxoId)
  const primaryClaimAddress = resolvePrimaryClaimAddress(exitStatuses ?? [], exitClaimAddresses)
  const needsClaimAddress = hasUnaddressedClaimable(exitStatuses ?? [], exitClaimAddresses)

  const shouldShowProgress =
    (isEmergencyExitAllInProgress && summary.total > 0 && !summary.isDone) || needsClaimAddress

  const disableStartButton = isEmergencyExitAllInProgress || isStartingExit || hasNoVtxos

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
      setDraftExitAddress('')
    } else {
      setDraftExitAddress(primaryClaimAddress ?? '')
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
    setClaimAddressDismissed(false)
    if (exitDialogMode === 'start') {
      setExitClaimAddresses(allVtxoIds, address)
      setIsEmergencyExitAllInProgress(true)
      startEmergencyExit()
      return
    }
    setExitClaimAddresses(exitingVtxoIds, address)
    setExitDialogOpen(false)
  }

  function handleExitDialogOpenChange(nextOpen: boolean) {
    if (!nextOpen && exitDialogMode === 'edit' && needsClaimAddress) {
      setClaimAddressDismissed(true)
    }
    setExitDialogOpen(nextOpen)
  }

  useEffect(() => {
    if (!needsClaimAddress || claimAddressDismissed || isExitDialogOpen) {
      return
    }
    setExitDialogMode('edit')
    setDraftExitAddress('')
    setExitDialogOpen(true)
  }, [needsClaimAddress, claimAddressDismissed, isExitDialogOpen])

  useEffect(() => {
    if (isEmergencyExitAllInProgress && summary.isDone) {
      setIsEmergencyExitAllInProgress(false)
    }
  }, [isEmergencyExitAllInProgress, summary.isDone, setIsEmergencyExitAllInProgress])

  const startButtonLabel = isEmergencyExitAllInProgress
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
        <FieldLabel htmlFor="interface-theme">{t('settings.theme.label')}</FieldLabel>
        <Select onValueChange={changeThemeWithTransition} value={theme}>
          <SelectTrigger id="interface-theme">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {THEME_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {t(`settings.theme.options.${option}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
          <FieldLabel htmlFor="discreet-mode">{t('settings.discreet_mode.label')}</FieldLabel>
          <FieldDescription>{t('settings.discreet_mode.description')}</FieldDescription>
        </FieldContent>
        <Switch checked={discreetMode} id="discreet-mode" onCheckedChange={setDiscreetMode} />
      </Field>
      <Field>
        <FieldLabel htmlFor="auto-refresh-threshold">
          {t('settings.auto_refresh.threshold.label')}
        </FieldLabel>
        <Select
          onValueChange={(value) => setAutoRefreshThresholdBlocks(Number(value))}
          value={String(selectedThresholdBlocks)}
        >
          <SelectTrigger id="auto-refresh-threshold">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {thresholdOptions.map((option) => (
              <SelectItem key={option.blocks} value={String(option.blocks)}>
                {formatThresholdOption(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldDescription>{t('settings.auto_refresh.threshold.description')}</FieldDescription>
      </Field>
      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor="refresh-on-receive">
            {t('settings.auto_refresh.on_receive.label')}
          </FieldLabel>
          <FieldDescription>{t('settings.auto_refresh.on_receive.description')}</FieldDescription>
        </FieldContent>
        <Switch
          checked={refreshOnReceive}
          id="refresh-on-receive"
          onCheckedChange={setRefreshOnReceive}
        />
      </Field>
      <Field orientation="responsive">
        <FieldContent>
          <FieldLabel>{t('settings.auto_refresh.manual.label')}</FieldLabel>
          <FieldDescription>{t('settings.auto_refresh.manual.description')}</FieldDescription>
        </FieldContent>
        <Button
          disabled={hasNoVtxos || isRoundActive || isRefreshing}
          onClick={() => refreshAll()}
          variant="outline"
        >
          <ArrowsClockwiseIcon
            className={isRoundActive || isRefreshing ? 'animate-spin' : undefined}
          />
          {isRoundActive
            ? t('settings.auto_refresh.manual.in_progress')
            : t('settings.auto_refresh.manual.button')}
        </Button>
      </Field>
      <Field>
        <FieldLabel htmlFor="seed-phrase">{t('settings.seed_phrase.label')}</FieldLabel>
        <FieldDescription>{t('settings.seed_phrase.description')}</FieldDescription>
        <SeedPhraseInput
          hideAriaLabel={t('settings.seed_phrase.hide_aria')}
          hiddenPlaceholder={SEED_HIDDEN_PLACEHOLDER}
          isLoading={isFetchingMnemonic}
          isRevealed={isSeedRevealed && mnemonic !== undefined}
          mnemonic={mnemonic}
          onToggle={handleToggleSeed}
          revealAriaLabel={t('settings.seed_phrase.reveal_aria')}
        />
        <Alert className="mt-2" variant="destructive">
          <WarningIcon />
          <AlertTitle>{t('settings.backup_warning.title')}</AlertTitle>
          <AlertDescription>
            <Trans
              components={{ code: <code className="font-mono text-xs" /> }}
              i18nKey="settings.backup_warning.description"
              values={{ path: config.walletDataPath }}
            />
          </AlertDescription>
        </Alert>
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
      <Field orientation="responsive">
        <FieldContent>
          <FieldLabel>{t('settings.diagnostics.label')}</FieldLabel>
          <FieldDescription>{t('settings.diagnostics.description')}</FieldDescription>
        </FieldContent>
        <Button
          loading={isDownloadingLogs}
          onClick={() => {
            void handleDownloadLogs()
          }}
          variant="outline"
        >
          <DownloadSimpleIcon />
          {t('settings.diagnostics.button')}
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
            destinationAddress={primaryClaimAddress}
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
    </div>
  )
}
