import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FullScreenLayout } from '@/components/full-screen-layout'
import { hasPasswordMismatch, NewPasswordFields } from '@/components/new-password-fields'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldDescription, FieldError, FieldGroup } from '@/components/ui/field'
import { useSetupUiPassword } from '@/hooks/use-setup-ui-password'
import { MIN_UI_PASSWORD_LENGTH } from '@/lib/auth-api'

// Replaces the login form while barkd runs with UI auth on and no password set —
// the state Umbrel and Start9 ship the app in.
export default function SetupPasswordPage() {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const { mutate: submit, isPending, data, reset } = useSetupUiPassword()

  const isTooShort = password.length < MIN_UI_PASSWORD_LENGTH
  const mismatch = hasPasswordMismatch(password, confirm)
  const failure = data?.ok === false ? data.reason : null

  function handleChange(setter: (value: string) => void) {
    return (value: string) => {
      if (failure !== null) {
        reset()
      }
      setter(value)
    }
  }

  function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isTooShort || mismatch) {
      return
    }
    submit(password)
  }

  return (
    <FullScreenLayout>
      <Card className="w-full bg-transparent shadow-none ring-0">
        <CardHeader>
          <CardTitle className="text-center font-bold text-3xl">
            {t('setup_password.title')}
          </CardTitle>
          <CardDescription className="text-pretty text-center text-lg">
            {t('setup_password.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <NewPasswordFields
                confirm={confirm}
                confirmLabel={t('setup_password.confirm_label')}
                disabled={isPending}
                idPrefix="setup"
                mismatchError={t('setup_password.error.mismatch')}
                newLabel={t('setup_password.label')}
                next={password}
                onConfirmChange={handleChange(setConfirm)}
                onNextChange={handleChange(setPassword)}
              />
              <FieldDescription>
                {t('setup_password.hint', { count: MIN_UI_PASSWORD_LENGTH })}
              </FieldDescription>
              {failure ? <FieldError>{t(`setup_password.error.${failure}`)}</FieldError> : null}
              <Button disabled={isTooShort || mismatch} loading={isPending} type="submit">
                {t('setup_password.submit')}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </FullScreenLayout>
  )
}
