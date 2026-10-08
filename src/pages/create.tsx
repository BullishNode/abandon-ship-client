import { zodResolver } from '@hookform/resolvers/zod'
import { generateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import { defineStepper } from '@stepperize/react'
import { useState } from 'react'
import { FormProvider, useForm, useFormContext } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
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
import { hasPasswordMismatch } from '@/components/new-password-fields'
import { OnboardingPasswordStep } from '@/components/onboarding-password-step'
import { SeedWord } from '@/components/seed-word'
import { SeedWordButton } from '@/components/seed-word-button'
import type { SeedWordStatus } from '@/components/seed-word-button'
import { StepIndicator } from '@/components/step-indicator'
import { StepSlide } from '@/components/step-slide'
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
import { config } from '@/config/runtime'
import { useOnboardingWallet } from '@/hooks/use-onboarding-wallet'
import { supportsWalletPassword } from '@/lib/backend-features'
import { NETWORKS } from '@/types/domain/network'
import { shuffleArray } from '@/utils/shuffle-array'

const walletNameSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .regex(/[a-zA-Z0-9]/u, 'Name must contain at least one letter or number')
})

// `chainSource` is not a form field: it is display-only, so it is read off
// `config` at submit time instead.
const networkAndServerSchema = z.object({
  arkServer: z.url(),
  network: z.enum(NETWORKS)
})

type WalletNameFormValues = z.infer<typeof walletNameSchema>

// The password step is filtered out in barkd builds, where the password is the
// server-side UI credential set by the auth gate before onboarding starts.
const { steps, useStepper } = defineStepper([
  { id: 'name', label: 'wallet.name.title', schema: walletNameSchema },
  {
    id: 'mnemonic',
    label: 'wallet.mnemonic.show.title',
    schema: z.object({})
  },
  { id: 'password', label: 'wallet.password.title', schema: z.object({}) },
  {
    id: 'server',
    label: 'wallet.backend.title',
    schema: networkAndServerSchema
  }
])

type MnemonicStage = 'show' | 'confirm'

const WORD_COUNT = 12

export default function CreateWalletPage() {
  const { t } = useTranslation()
  const stepper = useStepper()
  const [name, setName] = useState('')
  const [mnemonic, setMnemonic] = useState('')
  const [mnemonicStage, setMnemonicStage] = useState<MnemonicStage>('show')
  const [isMnemonicConfirmed, setIsMnemonicConfirmed] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const { mutate: createWallet, isPending: creatingWallet } = useOnboardingWallet()

  const form = useForm({
    defaultValues: {
      arkServer: config.arkServer,
      name: '',
      network: config.network
    },
    mode: 'onTouched',
    resolver: zodResolver(stepper.current.schema)
  })

  function goToNextStep() {
    setMnemonicStage('show')
    if (stepper.current.id === 'mnemonic' && !supportsWalletPassword) {
      void stepper.goTo('server')
      return
    }
    void stepper.next()
  }

  function onSubmit(values: z.infer<typeof stepper.current.schema>) {
    if (stepper.current.id === 'name' && 'name' in values) {
      setName(values.name)
      setMnemonic(generateMnemonic(wordlist))
    }

    if (stepper.current.id === 'mnemonic' && mnemonicStage === 'show') {
      setMnemonicStage('confirm')
      setIsMnemonicConfirmed(false)
      return
    }

    if (stepper.current.id === 'mnemonic' && mnemonicStage === 'confirm' && !isMnemonicConfirmed) {
      return
    }

    if (!stepper.isLast) {
      goToNextStep()
      return
    }

    if ('arkServer' in values && 'network' in values) {
      createWallet({ mnemonic, name, password, restore: false })
    }
  }

  function onSkip() {
    if (stepper.current.id === 'password') {
      setPassword('')
      setPasswordConfirm('')
    }
    goToNextStep()
  }

  const visibleSteps = steps.filter((step) => supportsWalletPassword || step.id !== 'password')
  const currentIndex = visibleSteps.findIndex((step) => step.id === stepper.current.id)

  const isNameStepInvalid = stepper.current.id === 'name' && !form.formState.isValid

  const isMnemonicConfirmIncomplete =
    stepper.current.id === 'mnemonic' && mnemonicStage === 'confirm' && !isMnemonicConfirmed

  const isPasswordIncomplete =
    stepper.current.id === 'password' &&
    (password.length === 0 || hasPasswordMismatch(password, passwordConfirm))

  const isSkippable = isMnemonicConfirmIncomplete || stepper.current.id === 'password'

  return (
    <StepsLayout>
      <StepsLayoutNav>
        {visibleSteps.map((step, index) => (
          <StepIndicator
            isActive={index <= currentIndex}
            key={step.id}
            label={t(step.label)}
            shortLabel={t([`${step.label}_short`, step.label])}
          />
        ))}
      </StepsLayoutNav>
      <FormProvider {...form}>
        <StepsLayoutForm onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}>
          <StepSlide
            stepKey={
              stepper.current.id === 'mnemonic' ? `mnemonic-${mnemonicStage}` : stepper.current.id
            }
          >
            {stepper.match({
              mnemonic: () => (
                <MnemonicComponent
                  mnemonic={mnemonic}
                  onConfirmedChange={setIsMnemonicConfirmed}
                  stage={mnemonicStage}
                />
              ),
              name: () => <WalletNameComponent />,
              password: () => (
                <OnboardingPasswordStep
                  confirm={passwordConfirm}
                  disabled={creatingWallet}
                  onConfirmChange={setPasswordConfirm}
                  onPasswordChange={setPassword}
                  password={password}
                />
              ),
              server: () => <NetworkAndServersComponent />
            })}
          </StepSlide>
          <StepsLayoutContentAction>
            {isSkippable ? (
              <Button onClick={onSkip} type="button" variant="outline">
                {t('actions.skip')}
              </Button>
            ) : null}
            <Button
              disabled={isNameStepInvalid || isMnemonicConfirmIncomplete || isPasswordIncomplete}
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

interface MnemonicComponentProps {
  mnemonic: string
  stage: MnemonicStage
  onConfirmedChange: (confirmed: boolean) => void
}

function MnemonicComponent({ stage, mnemonic, onConfirmedChange }: MnemonicComponentProps) {
  const { t } = useTranslation()

  const words = mnemonic.split(' ')
  const [shuffledWords] = useState(() => shuffleArray(words))

  const [selectedWords, setSelectedWords] = useState<string[]>([])
  const [status, setStatus] = useState<SeedWordStatus[]>(() =>
    Array.from({ length: WORD_COUNT }).map(() => 'idle')
  )

  function handleClick(word: string, index: number) {
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

      if (isValid && selectedWords.length === WORD_COUNT) {
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

    if (isValid && currentPosition === WORD_COUNT - 1) {
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
      <SeedLayout className="gap-2">
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
          <Select defaultValue={config.network} disabled>
            <SelectTrigger>
              <SelectValue placeholder={t(`network.${config.network}`)} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={config.network}>{t(`network.${config.network}`)}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>{t('backend.ark')}</FieldLabel>
          <Input disabled value={config.arkServer} />
        </Field>
        <Field>
          <FieldLabel>{t('backend.server')}</FieldLabel>
          <Input disabled value={config.chainSourceLabel} />
        </Field>
      </FieldGroup>
    </StepsLayoutContent>
  )
}
