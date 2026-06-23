import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import type { BitcoinUnit } from '@/types/bitcoin'
import { useSettingsStore } from '@/stores/settings'
import { formatBitcoin, formatBitcoinCompact } from '@/utils/format'

function withUnit(amount: string, sats: number, unit: BitcoinUnit, t: TFunction) {
  if (unit === 'sats') {
    return `${amount} ${t('bitcoin.sats_unit', { count: sats })}`
  }
  return `${amount} ${t('bitcoin.btc_unit')}`
}

export function useFormatBitcoin() {
  const { t } = useTranslation()
  const bitcoinUnit = useSettingsStore((state) => state.bitcoinUnit)
  return (sats: number) => withUnit(formatBitcoin(sats, bitcoinUnit), sats, bitcoinUnit, t)
}

export function useFormatBitcoinCompact() {
  const { t } = useTranslation()
  const bitcoinUnit = useSettingsStore((state) => state.bitcoinUnit)
  return (sats: number) => withUnit(formatBitcoinCompact(sats, bitcoinUnit), sats, bitcoinUnit, t)
}
