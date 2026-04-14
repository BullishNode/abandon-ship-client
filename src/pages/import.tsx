import { zodResolver } from '@hookform/resolvers/zod'
import { validateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import { BarkNetwork } from '@secondts/barkd'
import { defineStepper } from '@stepperize/react'
import { useState } from 'react'
import { FormProvider, useForm, useFormContext } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { SeedLayout } from '@/components/layout/seed-layout'
import {
  StepsLayout,
  StepsLayoutContent,
  StepsLayoutContentAction,
  StepsLayoutFooter,
  StepsLayoutForm,
  StepsLayoutNav
} from '@/components/layout/steps-layout'
import { SeedWordAutocomplete } from '@/components/seed-word-autocomplete'
import { StepIndicator } from '@/components/step-indicator'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useCreateWallet } from '@/hooks/barkd/use-create-wallet'

const walletNameSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .regex(/[a-zA-Z0-9]/, 'Name must contain at least one letter or number')
})

const mnemonicSchema = z.object({
  words: z.array(z.string().min(1, 'Word is required')).length(12, 'Must have exactly 12 words')
})

const networkAndServerSchema = z.object({
  arkServer: z.url(),
  chainSource: z.url(),
  network: z.enum(Object.values(BarkNetwork))
})

type WalletNameFormValues = z.infer<typeof walletNameSchema>
type MnemonicFormValues = z.infer<typeof mnemonicSchema>

const { useStepper, utils } = defineStepper(
  { id: 'name', label: 'wallet.name.title', schema: walletNameSchema },
  {
    id: 'mnemonic',
    label: 'wallet.mnemonic.show.title',
    schema: mnemonicSchema
  },
  {
    id: 'server',
    label: 'wallet.backend.title',
    schema: networkAndServerSchema
  }
)

const wordlistItems = wordlist.map((word) => ({ label: word, value: word }))

export default function ImportWalletPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const stepper = useStepper()
  const [name, setName] = useState('')
  const [mnemonic, setMnemonic] = useState('')
  const { mutate: createWallet, isPending: creatingWallet } = useCreateWallet({
    onSuccess: (data) => {
      if (data) {
        void navigate('/dashboard')
      }
    }
  })

  const form = useForm({
    defaultValues: {
      arkServer: 'https://ark.signet.2nd.dev',
      chainSource: 'https://esplora.signet.2nd.dev',
      name: '',
      network: 'signet',
      words: Array.from({ length: 12 }).map(() => '')
    },
    mode: 'onTouched',
    resolver: zodResolver(stepper.current.schema)
  })

  function onSubmit(values: z.infer<typeof stepper.current.schema>) {
    if (stepper.current.id === 'name' && 'name' in values) {
      setName(values.name)
    }

    if (stepper.current.id === 'mnemonic' && 'words' in values) {
      setMnemonic(values.words.join(' '))
    }

    if (!stepper.isLast) {
      return stepper.next()
    }

    if ('arkServer' in values && 'chainSource' in values && 'network' in values) {
      createWallet({
        arkServer: values.arkServer,
        chainSource: { esplora: { url: values.chainSource } },
        createdAt: new Date(),
        mnemonic,
        name,
        network: values.network
      })
    }
  }

  const currentIndex = utils.getIndex(stepper.current.id)
  const words = form.watch('words')
  const isMnemonicComplete = words.every((word) => wordlist.includes(word))
  const isMnemonicValid = isMnemonicComplete && validateMnemonic(words.join(' '), wordlist)
  const isNameStepInvalid = stepper.current.id === 'name' && !form.formState.isValid
  const isMnemonicIncomplete = stepper.current.id === 'mnemonic' && !isMnemonicValid

  return (
    <StepsLayout>
      <StepsLayoutNav>
        {stepper.all.map((step, index) => (
          <StepIndicator isActive={index <= currentIndex} key={step.id} label={t(step.label)} />
        ))}
      </StepsLayoutNav>
      <FormProvider {...form}>
        <StepsLayoutForm onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}>
          {stepper.switch({
            mnemonic: () => (
              <MnemonicInputComponent
                isMnemonicComplete={isMnemonicComplete}
                isMnemonicValid={isMnemonicValid}
              />
            ),
            name: () => <WalletNameComponent />,
            server: () => <NetworkAndServersComponent />
          })}
          <StepsLayoutContentAction>
            <Button
              disabled={isNameStepInvalid || isMnemonicIncomplete}
              loading={creatingWallet}
              type="submit"
            >
              {t('actions.continue')}
            </Button>
          </StepsLayoutContentAction>
        </StepsLayoutForm>
      </FormProvider>
      <StepsLayoutFooter>
        <Button asChild variant="ghost">
          <Link to="/">{t('actions.cancel')}</Link>
        </Button>
      </StepsLayoutFooter>
    </StepsLayout>
  )
}

function WalletNameComponent() {
  const { register } = useFormContext<WalletNameFormValues>()
  const { t } = useTranslation()

  return (
    <StepsLayoutContent description={t('wallet.name.description')} title={t('wallet.name.title')}>
      <Input
        {...register('name')}
        autoComplete="off"
        placeholder={t('wallet.name.placeholder')}
        required
      />
    </StepsLayoutContent>
  )
}

interface MnemonicInputComponentProps {
  isMnemonicComplete: boolean
  isMnemonicValid: boolean
}

function MnemonicInputComponent({
  isMnemonicComplete,
  isMnemonicValid
}: MnemonicInputComponentProps) {
  const { t } = useTranslation()
  const { setValue, getValues, watch } = useFormContext<MnemonicFormValues>()
  const words = watch('words')
  const [searchValues, setSearchValues] = useState(() => Array.from({ length: 12 }).map(() => ''))
  const showError = isMnemonicComplete && !isMnemonicValid

  function handleSearchChange(index: number, value: string) {
    setSearchValues((prev) => {
      const updated = [...prev]
      updated[index] = value
      return updated
    })
  }

  function handleValueChange(index: number, value: string) {
    const currentWords = getValues('words')
    const updatedWords = [...currentWords]
    updatedWords[index] = value
    setValue('words', updatedWords, { shouldValidate: true })
  }

  return (
    <StepsLayoutContent
      description={t('wallet.mnemonic.import.description', { count: 12 })}
      error={showError ? t('wallet.mnemonic.import.error.invalid') : undefined}
      title={t('wallet.mnemonic.import.title')}
    >
      <SeedLayout>
        {Array.from({ length: 12 }, (_, index) => ({
          id: `mnemonic-word-${index}`,
          index
        })).map(({ id, index }) => {
          const selectedValue = words[index] || ''
          const searchValue = searchValues[index]
          const normalizedSearch = searchValue.toLowerCase()
          const filteredItems =
            normalizedSearch.length > 0
              ? wordlistItems.filter((item) => item.value.startsWith(normalizedSearch))
              : []

          return (
            <SeedWordAutocomplete
              iconLeft={<span>{index + 1}</span>}
              items={filteredItems}
              key={id}
              onSearchValueChange={(value) => handleSearchChange(index, value)}
              onSelectedValueChange={(value) => handleValueChange(index, value)}
              searchValue={searchValue}
              selectedValue={selectedValue}
            />
          )
        })}
      </SeedLayout>
    </StepsLayoutContent>
  )
}

function NetworkAndServersComponent() {
  const { t } = useTranslation()

  return (
    <StepsLayoutContent
      description={t('wallet.backend.description')}
      title={t('wallet.backend.title')}
    >
      <FieldGroup>
        <Field>
          <FieldLabel>{t('backend.network')}</FieldLabel>
          <Select defaultValue="signet" disabled>
            <SelectTrigger>
              <SelectValue placeholder={t('network.signet')} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="signet">{t('network.signet')}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>{t('backend.ark')}</FieldLabel>
          <Input disabled placeholder="ark.signet.2nd.dev" value="ark.signet.2nd.dev" />
        </Field>
        <Field>
          <FieldLabel>{t('backend.server')}</FieldLabel>
          <Input disabled placeholder="esplora.signet.2nd.dev" value="esplora.signet.2nd.dev" />
        </Field>
      </FieldGroup>
    </StepsLayoutContent>
  )
}
