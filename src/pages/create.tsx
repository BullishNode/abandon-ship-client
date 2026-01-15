import { zodResolver } from '@hookform/resolvers/zod'
import { generateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import { defineStepper } from '@stepperize/react'
import { useMemo, useState } from 'react'
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
import { SeedWord } from '@/components/seed-word'
import {
  SeedWordButton,
  type SeedWordStatus
} from '@/components/seed-word-button'
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
import { useCreateWallet } from '@/hooks/proxy/use-create-wallet'
import { shuffleArray } from '@/utils/shuffle-array'

const walletNameSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .regex(/[a-zA-Z0-9]/, 'Name must contain at least one letter or number')
})

const networkAndServerSchema = z.object({
  network: z.string(),
  arkServer: z.url(),
  server: z.url()
})

type WalletNameFormValues = z.infer<typeof walletNameSchema>

const { useStepper, utils } = defineStepper(
  { id: 'name', label: 'wallet.name.title', schema: walletNameSchema },
  {
    id: 'mnemonic',
    label: 'wallet.mnemonic.show.title',
    schema: z.object({})
  },
  {
    id: 'server',
    label: 'wallet.backend.title',
    schema: networkAndServerSchema
  }
)

type MnemonicStage = 'show' | 'confirm'

export default function CreateWalletPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const stepper = useStepper()
  const [name, setName] = useState<string>('')
  const [mnemonic, setMnemonic] = useState<string>('')
  const [mnemonicStage, setMnemonicStage] = useState<MnemonicStage>('show')
  const [isMnemonicConfirmed, setIsMnemonicConfirmed] = useState(false)
  const { mutate: createWallet, isPending: creatingWallet } = useCreateWallet({
    onSuccess: (data) => {
      if (data) {
        navigate('/dashboard')
      }
    }
  })

  const form = useForm({
    mode: 'onTouched',
    resolver: zodResolver(stepper.current.schema),
    defaultValues: {
      name: '',
      network: 'signet',
      arkServer: 'https://ark.signet.2nd.dev',
      server: 'https://esplora.signet.2nd.dev'
    }
  })

  const onSubmit = (values: z.infer<typeof stepper.current.schema>) => {
    if (stepper.current.id === 'name' && 'name' in values) {
      setName(values.name)
      setMnemonic(generateMnemonic(wordlist))
    }

    if (stepper.current.id === 'mnemonic' && mnemonicStage === 'show') {
      setMnemonicStage('confirm')
      setIsMnemonicConfirmed(false)
      return
    }

    if (
      stepper.current.id === 'mnemonic' &&
      mnemonicStage === 'confirm' &&
      !isMnemonicConfirmed
    ) {
      return
    }

    if (!stepper.isLast) {
      setMnemonicStage('show')
      return stepper.next()
    }

    createWallet({ name, mnemonic, createdAt: new Date() })
  }

  const currentIndex = utils.getIndex(stepper.current.id)

  const isNameStepInvalid =
    stepper.current.id === 'name' && !form.formState.isValid

  return (
    <StepsLayout>
      <StepsLayoutNav>
        {stepper.all.map((step, index) => (
          <StepIndicator
            isActive={index <= currentIndex}
            key={step.id}
            label={t(step.label)}
          />
        ))}
      </StepsLayoutNav>
      <FormProvider {...form}>
        <StepsLayoutForm onSubmit={form.handleSubmit(onSubmit)}>
          {stepper.switch({
            name: () => <WalletNameComponent />,
            mnemonic: () => (
              <MnemonicComponent
                mnemonic={mnemonic}
                onConfirmedChange={setIsMnemonicConfirmed}
                stage={mnemonicStage}
              />
            ),
            server: () => <NetworkAndServersComponent />
          })}
          <StepsLayoutContentAction>
            <Button
              disabled={isNameStepInvalid}
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
    <StepsLayoutContent
      description={t('wallet.name.description')}
      title={t('wallet.name.title')}
    >
      <Input
        {...register('name')}
        placeholder={t('wallet.name.placeholder')}
        required
      />
    </StepsLayoutContent>
  )
}

interface MnemonicComponentProps {
  mnemonic: string
  stage: MnemonicStage
  onConfirmedChange: (confirmed: boolean) => void
}

function MnemonicComponent({
  stage,
  mnemonic,
  onConfirmedChange
}: MnemonicComponentProps) {
  const { t } = useTranslation()

  const words = mnemonic.split(' ')
  const shuffledWords = useMemo(() => shuffleArray(words), [words])

  const [selectedWords, setSelectedWords] = useState<string[]>([])
  const [status, setStatus] = useState<SeedWordStatus[]>(
    Array.from({ length: 12 }).map(() => 'idle')
  )

  const handleClick = (word: string, index: number) => {
    const lastInvalidIndex = status.indexOf('invalid')
    const isLastWordInvalid = lastInvalidIndex !== -1
    const lastSelectedWord = selectedWords.at(-1)

    if (isLastWordInvalid && word === lastSelectedWord) {
      setSelectedWords((prev) => prev.slice(0, -1))
      setStatus((prev) => {
        const updated = [...prev]
        updated[lastInvalidIndex] = 'idle'
        return updated
      })
      return
    }

    if (selectedWords.includes(word)) {
      return
    }

    if (isLastWordInvalid) {
      const positionToValidate = selectedWords.length - 1
      const isValid = word === words[positionToValidate]

      setSelectedWords((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = word
        return updated
      })
      setStatus((prev) => {
        const updated = [...prev]
        updated[lastInvalidIndex] = 'idle'
        updated[index] = isValid ? 'valid' : 'invalid'
        return updated
      })

      if (isValid && selectedWords.length === 12) {
        onConfirmedChange(true)
      }

      return
    }

    const currentPosition = selectedWords.length
    const isValid = word === words[currentPosition]

    setSelectedWords([...selectedWords, word])
    setStatus((prev) => {
      const updated = [...prev]
      updated[index] = isValid ? 'valid' : 'invalid'
      return updated
    })

    if (isValid && currentPosition === 11) {
      onConfirmedChange(true)
    }
  }

  if (stage === 'show') {
    return (
      <StepsLayoutContent
        description={t('wallet.mnemonic.show.description')}
        title={t('wallet.mnemonic.show.title')}
      >
        <SeedLayout>
          {words.map((word, index) => (
            <SeedWord key={word} position={index + 1} word={word} />
          ))}
        </SeedLayout>
      </StepsLayoutContent>
    )
  }

  return (
    <StepsLayoutContent
      description={t('wallet.mnemonic.confirm.description')}
      title={t('wallet.mnemonic.confirm.title')}
    >
      <SeedLayout>
        {shuffledWords.map((word, index) => {
          const selectedIndex = selectedWords.indexOf(word)
          const isSelected = selectedIndex !== -1

          return (
            <SeedWordButton
              key={word}
              onClick={() => handleClick(word, index)}
              selectedPosition={isSelected ? selectedIndex + 1 : undefined}
              status={status[index]}
              word={word}
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
          <Input
            disabled
            placeholder="ark.signet.2nd.dev"
            value="ark.signet.2nd.dev"
          />
        </Field>
        <Field>
          <FieldLabel>{t('backend.server')}</FieldLabel>
          <Input
            disabled
            placeholder="esplora.signet.2nd.dev"
            value="esplora.signet.2nd.dev"
          />
        </Field>
      </FieldGroup>
    </StepsLayoutContent>
  )
}
