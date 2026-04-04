import { useTranslation } from 'react-i18next'
import { useSettingsStore } from '@/stores/settings'
import { formatBitcoin } from '@/utils/format'

export function useFormatBitcoin() {
  const { t } = useTranslation()
  const bitcoinUnit = useSettingsStore((state) => state.bitcoinUnit)

  function format(sats: number) {
    const formattedAmount = formatBitcoin(sats, bitcoinUnit)

    if (bitcoinUnit === 'sats') {
      return `${formattedAmount} ${t('bitcoin.sats_unit', { count: sats })}`
    }

    return `${formattedAmount} ${t('bitcoin.btc_unit')}`
  }

  return format
}
