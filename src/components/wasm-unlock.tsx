import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FullScreenLayout } from '@/components/full-screen-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupTextarea } from '@/components/ui/input-group'
import { Input } from '@/components/ui/input'
import { useUnlockWallet } from '@/hooks/use-unlock-wallet'
import { useUnlockWithPassword } from '@/hooks/use-wallet-password'
// Static imports of the WASM vault: this component is only reached through the
// login page's __BACKEND__-guarded lazy import, so it stays out of barkd builds.
import { hasVault, InvalidPasswordError } from '@/lib/backend/wasm'
import { isValidMnemonic, MNEMONIC_WORD_COUNT, normalizeMnemonic } from '@/utils/mnemonic'

type UnlockMode = 'password' | 'mnemonic'

export default function WasmUnlock() {
  const [hadVault] = useState(hasVault)
  const [mode, setMode] = useState<UnlockMode>(hadVault ? 'password' : 'mnemonic')

  if (mode === 'password') {
    return <PasswordUnlock onForgot={() => setMode('mnemonic')} />
  }
  return (
    <MnemonicUnlock
      canGoBack={hadVault}
      clearVaultOnSuccess={hadVault}
      onBack={() => setMode('password')}
    />
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
      <Card className="min-w-sm shadow-none ring-0">
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
              <Button disabled={!canSubmit} loading={isPending} type="submit">
                {t('unlock.password.submit')}
              </Button>
              <Button onClick={onForgot} type="button" variant="ghost">
                {t('unlock.password.forgot')}
              </Button>
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
  const [value, setValue] = useState('')
  const { mutate, isPending, isError, reset } = useUnlockWallet()
  const mnemonic = normalizeMnemonic(value)
  const canSubmit = isValidMnemonic(mnemonic)

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

  return (
    <FullScreenLayout>
      <Card className="min-w-sm shadow-none ring-0">
        <CardHeader>
          <CardTitle className="text-center font-bold text-3xl">
            {t('wallet.mnemonic.import.title')}
          </CardTitle>
          <CardDescription className="text-center text-lg">
            {t('wallet.mnemonic.import.description', { count: MNEMONIC_WORD_COUNT })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <InputGroup>
                  <InputGroupTextarea
                    aria-label={t('wallet.mnemonic.import.title')}
                    autoComplete="off"
                    className="wrap-break-word font-mono text-sm leading-relaxed"
                    onChange={(event) => {
                      setValue(event.target.value)
                      if (isError) {
                        reset()
                      }
                    }}
                    rows={3}
                    spellCheck={false}
                    value={value}
                  />
                </InputGroup>
                {isError ? <FieldError>{t('unlock.mnemonic.error')}</FieldError> : null}
              </Field>
              <Button disabled={!canSubmit} loading={isPending} type="submit">
                {t('actions.continue')}
              </Button>
              {canGoBack ? (
                <Button onClick={onBack} type="button" variant="ghost">
                  {t('unlock.mnemonic.back')}
                </Button>
              ) : null}
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </FullScreenLayout>
  )
}
