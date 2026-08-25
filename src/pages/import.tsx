import { zodResolver } from '@hookform/resolvers/zod'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import { defineStepper } from '@stepperize/react'
import { useState } from 'react'
import { FormProvider, useForm, useFormContext, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import {
  StepsLayout,
  StepsLayoutContent,
  StepsLayoutContentAction,
  StepsLayoutFooter,
  StepsLayoutForm,
  StepsLayoutNav
} from '@/components/layout/steps-layout'
import { MnemonicWordsInput } from '@/components/mnemonic-words-input'
import { hasPasswordMismatch } from '@/components/new-password-fields'
import { OnboardingPasswordStep } from '@/components/onboarding-password-step'
import { StepIndicator } from '@/components/step-indicator'
import { StepSlide } from '@/components/step-slide'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
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
import {
  supportsBirthdayHeight,
  supportsWalletPassword,
  usesServerAssistedRecovery
} from '@/lib/backend-features'
import { NETWORKS } from '@/types/domain/network'
import {
  BIRTHDAY_HEIGHT_REQUIRED,
  birthdayHeightSchema,
  birthdayHeightSchemaFor,
  requiresBirthdayHeight
} from '@/utils/birthday-height'
import { createEmptyMnemonicWords, isValidMnemonic, MNEMONIC_WORD_COUNT } from '@/utils/mnemonic'

const walletNameSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .regex(/[a-zA-Z0-9]/u, 'Name must contain at least one letter or number')
})

const mnemonicSchema = z.object({
  words: z
    .array(z.string().min(1, 'Word is required'))
    .length(MNEMONIC_WORD_COUNT, `Must have exactly ${MNEMONIC_WORD_COUNT} words`)
})

// `chainSource` is not a form field: it is display-only, so it is read off
// `config` at submit time instead.
const networkAndServerSchema = z.object({
  arkServer: z.url(),
  // A hidden field must never gate submit, so the required-under-bitcoind
  // refinement is only attached where the field is rendered.
  birthdayHeight: supportsBirthdayHeight
    ? birthdayHeightSchemaFor(() => config.chainSource)
    : birthdayHeightSchema,
  network: z.enum(NETWORKS)
})

type WalletNameFormValues = z.infer<typeof walletNameSchema>
type MnemonicFormValues = z.infer<typeof mnemonicSchema>
// The registered input yields a string; the resolver outputs `number | undefined`.
interface NetworkAndServerFormValues {
  birthdayHeight: string
}

// The password step is filtered out in barkd builds, where the password is the
// server-side UI credential set by the auth gate before onboarding starts.
const { steps, useStepper } = defineStepper([
  { id: 'name', label: 'wallet.name.title', schema: walletNameSchema },
  {
    id: 'mnemonic',
    label: 'wallet.mnemonic.show.title',
    schema: mnemonicSchema
  },
  { id: 'password', label: 'wallet.password.title', schema: z.object({}) },
  {
    id: 'server',
    label: 'wallet.backend.title',
    schema: networkAndServerSchema
  }
])

export default function ImportWalletPage() {
  const { t } = useTranslation()
  const stepper = useStepper()
  const [name, setName] = useState('')
  const [mnemonic, setMnemonic] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const { mutate: createWallet, isPending: creatingWallet } = useOnboardingWallet()

  const form = useForm({
    defaultValues: {
      arkServer: config.arkServer,
      birthdayHeight: '',
      name: '',
      network: config.network,
      words: createEmptyMnemonicWords()
    },
    mode: 'onTouched',
    resolver: zodResolver(stepper.current.schema)
  })

  function goToNextStep() {
    if (stepper.current.id === 'mnemonic' && !supportsWalletPassword) {
      void stepper.goTo('server')
      return
    }
    void stepper.next()
  }

  function onSubmit(values: z.infer<typeof stepper.current.schema>) {
    if (stepper.current.id === 'name' && 'name' in values) {
      setName(values.name)
    }

    if (stepper.current.id === 'mnemonic' && 'words' in values) {
      setMnemonic(values.words.join(' '))
    }

    if (!stepper.isLast) {
      goToNextStep()
      return
    }

    if ('arkServer' in values && 'network' in values) {
      createWallet({
        birthdayHeight: values.birthdayHeight,
        mnemonic,
        name,
        password,
        restore: true
      })
    }
  }

  function onSkipPassword() {
    setPassword('')
    setPasswordConfirm('')
    goToNextStep()
  }

  const visibleSteps = steps.filter((step) => supportsWalletPassword || step.id !== 'password')
  const currentIndex = visibleSteps.findIndex((step) => step.id === stepper.current.id)
  const words = form.watch('words')
  const isMnemonicComplete = words.every((word) => wordlist.includes(word))
  const isMnemonicValid = isMnemonicComplete && isValidMnemonic(words.join(' '))
  const isNameStepInvalid = stepper.current.id === 'name' && !form.formState.isValid
  const isMnemonicIncomplete = stepper.current.id === 'mnemonic' && !isMnemonicValid
  const isPasswordStep = stepper.current.id === 'password'
  const isPasswordIncomplete =
    isPasswordStep && (password.length === 0 || hasPasswordMismatch(password, passwordConfirm))

  return (
    <StepsLayout>
      <StepsLayoutNav>
        {visibleSteps.map((step, index) => (
          <StepIndicator isActive={index <= currentIndex} key={step.id} label={t(step.label)} />
        ))}
      </StepsLayoutNav>
      <FormProvider {...form}>
        <StepsLayoutForm onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}>
          <StepSlide stepKey={stepper.current.id}>
            {stepper.match({
              mnemonic: () => (
                <MnemonicInputComponent
                  isMnemonicComplete={isMnemonicComplete}
                  isMnemonicValid={isMnemonicValid}
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
            {isPasswordStep ? (
              <Button onClick={onSkipPassword} type="button" variant="outline">
                {t('actions.skip')}
              </Button>
            ) : null}
            <Button
              disabled={isNameStepInvalid || isMnemonicIncomplete || isPasswordIncomplete}
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
  const { setValue, getValues } = useFormContext<MnemonicFormValues>()
  const words = useWatch<MnemonicFormValues, 'words'>({ name: 'words' })
  const showError = isMnemonicComplete && !isMnemonicValid

  return (
    <StepsLayoutContent
      description={t('wallet.mnemonic.import.description', { count: MNEMONIC_WORD_COUNT })}
      error={showError ? t('wallet.mnemonic.import.error.invalid') : undefined}
      title={t('wallet.mnemonic.import.title')}
    >
      <MnemonicWordsInput
        onWordsChange={(update) =>
          setValue('words', update(getValues('words')), { shouldValidate: true })
        }
        words={words}
      />
      {usesServerAssistedRecovery ? (
        <FieldDescription>{t('wallet.mnemonic.import.recovery_notice')}</FieldDescription>
      ) : null}
    </StepsLayoutContent>
  )
}

function NetworkAndServersComponent() {
  const { t } = useTranslation()
  const {
    register,
    formState: { errors }
  } = useFormContext<NetworkAndServerFormValues>()
  const isRequired = requiresBirthdayHeight(config.chainSource)
  const error = errors.birthdayHeight
  const isMissing = error?.message === BIRTHDAY_HEIGHT_REQUIRED

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
        {supportsBirthdayHeight ? (
          <Field data-invalid={error !== undefined}>
            <FieldLabel htmlFor="birthdayHeight">
              {isRequired
                ? t('backend.birthday_height.label_required')
                : t('backend.birthday_height.label')}
            </FieldLabel>
            <Input
              {...register('birthdayHeight')}
              aria-invalid={error !== undefined}
              aria-required={isRequired}
              id="birthdayHeight"
              inputMode="numeric"
              placeholder={t('backend.birthday_height.placeholder')}
            />
            <FieldDescription>
              {isRequired
                ? t('backend.birthday_height.description_required')
                : t('backend.birthday_height.description')}
            </FieldDescription>
            {error !== undefined && (
              <FieldError>
                {isMissing
                  ? t('backend.birthday_height.error_required')
                  : t('backend.birthday_height.error')}
              </FieldError>
            )}
          </Field>
        ) : null}
      </FieldGroup>
    </StepsLayoutContent>
  )
}
