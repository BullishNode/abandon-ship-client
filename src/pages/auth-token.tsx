import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FullScreenLayout } from '@/components/full-screen-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useConnectAuthToken } from '@/hooks/use-connect-auth-token'
import { isValidAuthTokenFormat } from '@/lib/backend/barkd/auth-token'
import { useAuthStore } from '@/stores/auth'

export default function AuthTokenPage() {
  const { t } = useTranslation()
  const tokenRejected = useAuthStore((state) => state.tokenRejected)
  const [token, setToken] = useState('')
  const [formatError, setFormatError] = useState(false)
  const { mutate: connect, isPending, data, reset } = useConnectAuthToken()

  const failure = data?.ok === false ? data.reason : null
  const shownFailure = formatError ? 'format' : failure

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    setFormatError(false)
    if (failure !== null) {
      reset()
    }
    setToken(event.target.value)
  }

  function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = token.trim()
    if (!isValidAuthTokenFormat(trimmed)) {
      setFormatError(true)
      return
    }
    connect(trimmed)
  }

  return (
    <FullScreenLayout>
      <Card className="w-full bg-transparent shadow-none ring-0">
        <CardHeader>
          <CardTitle className="text-center font-bold text-3xl">{t('auth_token.title')}</CardTitle>
          <CardDescription className="text-pretty text-center text-lg">
            {tokenRejected ? t('auth_token.rejected') : t('auth_token.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="auth-token">{t('auth_token.label')}</FieldLabel>
                <Input
                  aria-invalid={shownFailure === null ? undefined : true}
                  autoCapitalize="off"
                  autoComplete="off"
                  autoCorrect="off"
                  className="font-mono aria-invalid:ring-0 focus-visible:aria-invalid:ring-[3px]"
                  disabled={isPending}
                  id="auth-token"
                  onChange={handleChange}
                  spellCheck={false}
                  type="password"
                  value={token}
                />
                {shownFailure ? (
                  <FieldError>{t(`auth_token.error.${shownFailure}`)}</FieldError>
                ) : null}
              </Field>
              <Button disabled={token.trim().length === 0} loading={isPending} type="submit">
                {t('auth_token.submit')}
              </Button>
            </FieldGroup>
          </form>
          <section className="flex flex-col gap-2 text-sm">
            <h2 className="font-medium text-foreground">{t('auth_token.where.title')}</h2>
            <FieldDescription>{t('auth_token.where.log')}</FieldDescription>
            <FieldDescription>{t('auth_token.where.cli')}</FieldDescription>
            <code className="rounded-md bg-muted px-2 py-1 font-mono text-foreground text-xs">
              barkd secret show
            </code>
            <FieldDescription>{t('auth_token.where.file')}</FieldDescription>
            <code className="rounded-md bg-muted px-2 py-1 font-mono text-foreground text-xs">
              &lt;datadir&gt;/auth_token
            </code>
          </section>
        </CardContent>
      </Card>
    </FullScreenLayout>
  )
}
