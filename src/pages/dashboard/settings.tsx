import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { Field, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useSettingsStore } from '@/stores/settings'
import type { BitcoinUnit } from '@/types/bitcoin'

const BITCOIN_UNITS: { value: BitcoinUnit; label: string }[] = [
  { label: 'Satoshi', value: 'sats' },
  { label: 'Bitcoin', value: 'btc' }
]

export default function SettingsPage() {
  const { t } = useTranslation()
  const [bitcoinUnit, setBitcoinUnit] = useSettingsStore(
    useShallow((state) => [state.bitcoinUnit, state.setBitcoinUnit])
  )
  const [discreteMode, setDiscreteMode] = useSettingsStore(
    useShallow((state) => [state.discreteMode, state.setDiscreteMode])
  )

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="font-bold text-2xl">Settings</h1>
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
    </div>
  )
}
