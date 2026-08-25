import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FullScreenLayout } from '@/components/full-screen-layout'
import { StepsLayoutContentAction, StepsLayoutFooter } from '@/components/layout/steps-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MnemonicWordsInput } from '@/components/mnemonic-words-input'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useEraseWallet } from '@/hooks/use-erase-wallet'
import { useRetryDeviceUnlock, useUnlockWallet } from '@/hooks/use-unlock-wallet'
import { useUnlockWithPassword } from '@/hooks/use-wallet-password'
// Static imports of the WASM vault: this component is only reached through the
// login page's __BACKEND__-guarded lazy import, so it stays out of barkd builds.
import { hasVault, InvalidPasswordError } from '@/lib/backend/wasm'
import { useAuthStore } from '@/stores/auth'
import { createEmptyMnemonicWords, isValidMnemonic, MNEMONIC_WORD_COUNT } from '@/utils/mnemonic'

type UnlockMode = 'password' | 'mnemonic' | 'retry'

function initialUnlockMode(hadVault: boolean, deviceUnlockFailed: boolean): UnlockMode {
  if (hadVault) {
    return 'password'
  }
  return deviceUnlockFailed ? 'retry' : 'mnemonic'
}

export default function WasmUnlock() {
  const [hadVault] = useState(hasVault)
  const deviceUnlockFailed = useAuthStore((state) => state.deviceUnlockFailed)
  const [mode, setMode] = useState<UnlockMode>(() =>
    initialUnlockMode(hadVault, deviceUnlockFailed)
  )

  if (mode === 'password') {
    return <PasswordUnlock onForgot={() => setMode('mnemonic')} />
  }
  if (mode === 'retry') {
    return <RetryUnlock onUseMnemonic={() => setMode('mnemonic')} />
  }
  return (
    <MnemonicUnlock
      canGoBack={hadVault}
      clearVaultOnSuccess={hadVault}
      onBack={() => setMode('password')}
    />
  )
}

function RetryUnlock({ onUseMnemonic }: { onUseMnemonic: () => void }) {
  const { t } = useTranslation()
  const { mutate, isPending, isError } = useRetryDeviceUnlock()

  return (
    <FullScreenLayout>
      <Card className="min-w-sm bg-transparent shadow-none ring-0">
        <CardHeader>
          <CardTitle className="text-center font-bold text-3xl">
            {t('unlock.retry.title')}
          </CardTitle>
          <CardDescription className="text-center text-lg">
            {t('unlock.retry.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {isError ? (
              <FieldError className="text-center">{t('unlock.retry.error')}</FieldError>
            ) : null}
            <StepsLayoutContentAction>
              <Button
                loading={isPending}
                onClick={() =>
                  mutate(undefined, {
                    onSuccess: (status) => {
                      if (status === 'no-vault') {
                        onUseMnemonic()
                      }
                    }
                  })
                }
                type="button"
              >
                {t('unlock.retry.submit')}
              </Button>
            </StepsLayoutContentAction>
            <StepsLayoutFooter className="items-center">
              <Button onClick={onUseMnemonic} type="button" variant="ghost">
                {t('unlock.retry.use_mnemonic')}
              </Button>
            </StepsLayoutFooter>
          </FieldGroup>
        </CardContent>
      </Card>
    </FullScreenLayout>
  )
}

function PasswordUnlock({ onForgot }: { onForgot: () => void }) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const { mutate, isPending, isError, error, reset } = useUnlockWithPassword()
  const canSubmit = password.length > 0
  // A wrong password is the only InvalidPasswordError source; anything else
  // (ark server unreachable, worker init failure) must not blame the password.
  const errorKey =
    error instanceof InvalidPasswordError
      ? 'unlock.password.error_invalid'
      : 'unlock.password.error_generic'

  function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    if (canSubmit) {
      mutate(password)
    }
  }

  return (
    <FullScreenLayout>
      <Card className="min-w-sm bg-transparent shadow-none ring-0">
        <CardHeader>
          <CardTitle className="text-center font-bold text-3xl">
            {t('unlock.password.title')}
          </CardTitle>
          <CardDescription className="text-center text-lg">
            {t('unlock.password.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="unlock-password">{t('unlock.password.label')}</FieldLabel>
                <Input
                  aria-invalid={isError ? true : undefined}
                  autoComplete="current-password"
                  className="aria-invalid:ring-0 focus-visible:aria-invalid:ring-[3px]"
                  id="unlock-password"
                  onChange={(event) => {
                    setPassword(event.target.value)
                    if (isError) {
                      reset()
                    }
                  }}
                  type="password"
                  value={password}
                />
                {isError ? <FieldError>{t(errorKey)}</FieldError> : null}
              </Field>
              <StepsLayoutContentAction>
                <Button disabled={!canSubmit} loading={isPending} type="submit">
                  {t('unlock.password.submit')}
                </Button>
              </StepsLayoutContentAction>
              <StepsLayoutFooter className="items-center">
                <Button onClick={onForgot} type="button" variant="ghost">
                  {t('unlock.password.forgot')}
                </Button>
              </StepsLayoutFooter>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </FullScreenLayout>
  )
}

interface MnemonicUnlockProps {
  canGoBack: boolean
  clearVaultOnSuccess: boolean
  onBack: () => void
}

function MnemonicUnlock({ canGoBack, clearVaultOnSuccess, onBack }: MnemonicUnlockProps) {
  const { t } = useTranslation()
  const [words, setWords] = useState<string[]>(createEmptyMnemonicWords)
  const [eraseOpen, setEraseOpen] = useState(false)
  const { mutate, isPending, isError, reset } = useUnlockWallet()
  const { mutate: eraseWallet, isPending: erasing } = useEraseWallet()
  const mnemonic = words.join(' ')
  const isComplete = words.every((word) => word.length > 0)
  const isMnemonicValid = isValidMnemonic(mnemonic)
  const canSubmit = isMnemonicValid && !erasing
  const hasChecksumError = isComplete && !isMnemonicValid

  function errorMessage(): string | undefined {
    if (hasChecksumError) {
      return t('wallet.mnemonic.import.error.invalid')
    }
    return isError ? t('unlock.mnemonic.error') : undefined
  }
  const error = errorMessage()

  function handleWordsChange(update: (currentWords: string[]) => string[]) {
    setWords(update)
    if (isError) {
      reset()
    }
  }

  function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) {
      return
    }
    mutate(
      { clearPasswordVault: clearVaultOnSuccess, mnemonic },
      {
        onSuccess: () => {
          if (clearVaultOnSuccess) {
            toast.info(t('unlock.mnemonic.vault_cleared'))
          }
        }
      }
    )
  }

  function handleEraseConfirm() {
    eraseWallet(undefined, {
      onError: () => {
        setEraseOpen(false)
        toast.error(t('unlock.mnemonic.erase.error'))
      }
    })
  }

  return (
    <FullScreenLayout>
      <Card className="w-full bg-transparent shadow-none ring-0">
        <CardHeader>
          <CardTitle className="text-center font-bold text-3xl">
            {t('unlock.mnemonic.title')}
          </CardTitle>
          {error === undefined ? (
            <CardDescription className="text-center text-lg">
              {t('unlock.mnemonic.description', { count: MNEMONIC_WORD_COUNT })}
            </CardDescription>
          ) : (
            <FieldError className="text-pretty text-center text-destructive text-lg">
              {error}
            </FieldError>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <MnemonicWordsInput onWordsChange={handleWordsChange} words={words} />
              <StepsLayoutContentAction>
                <Button disabled={!canSubmit} loading={isPending} type="submit">
                  {t('actions.continue')}
                </Button>
              </StepsLayoutContentAction>
              <StepsLayoutFooter className="items-center">
                {canGoBack ? (
                  <Button disabled={erasing} onClick={onBack} type="button" variant="ghost">
                    {t('unlock.mnemonic.back')}
                  </Button>
                ) : null}
                <Button
                  disabled={isPending || erasing}
                  onClick={() => setEraseOpen(true)}
                  type="button"
                  variant="ghost"
                >
                  {t('unlock.mnemonic.erase.button')}
                </Button>
              </StepsLayoutFooter>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <ConfirmDialog
        confirmLabel={t('unlock.mnemonic.erase.confirm_label')}
        description={t('unlock.mnemonic.erase.confirm_description')}
        loading={erasing}
        onConfirm={handleEraseConfirm}
        onOpenChange={(open) => {
          if (!erasing) {
            setEraseOpen(open)
          }
        }}
        open={eraseOpen}
        title={t('unlock.mnemonic.erase.confirm_title')}
        variant="destructive"
      />
    </FullScreenLayout>
  )
}
