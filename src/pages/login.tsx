import { zodResolver } from '@hookform/resolvers/zod'
import { lazy, Suspense, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { FullScreenLayout } from '@/components/full-screen-layout'
import { LoadingScreen } from '@/components/loading-screen'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { login } from '@/lib/auth-api'
import type { LoginFailureReason } from '@/types/auth'

const loginSchema = z.object({
  password: z.string().min(1)
})
type LoginFormValues = z.infer<typeof loginSchema>

// In WASM mode the login screen is the seed-unlock screen. The lazy import is
// guarded by the build-time backend literal so the WASM client (and its worker)
// is dropped entirely from barkd builds by dead-code elimination.
const WasmUnlock =
  __BACKEND__ === 'wasm' ? lazy(async () => await import('@/components/wasm-unlock')) : null

export default function LoginPage() {
  if (WasmUnlock !== null) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <WasmUnlock />
      </Suspense>
    )
  }
  return <BarkdLoginPage />
}

function BarkdLoginPage() {
  const { t } = useTranslation()
  const [failure, setFailure] = useState<LoginFailureReason | null>(null)
  const { formState, handleSubmit, register } = useForm<LoginFormValues>({
    defaultValues: { password: '' },
    mode: 'onTouched',
    resolver: zodResolver(loginSchema)
  })

  async function onSubmit(values: LoginFormValues) {
    setFailure(null)
    const result = await login(values.password)
    if (result.ok) {
      window.location.reload()
      return
    }
    setFailure(result.reason)
  }

  return (
    <FullScreenLayout>
      <Card className="min-w-sm bg-transparent shadow-none ring-0">
        <CardHeader>
          <CardTitle className="text-center font-bold text-3xl">{t('login.title')}</CardTitle>
          <CardDescription className="text-center text-lg">
            {t('login.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="password">{t('login.password')}</FieldLabel>
                <Input
                  {...register('password', { onChange: () => setFailure(null) })}
                  aria-invalid={failure === null ? undefined : true}
                  autoComplete="current-password"
                  className="aria-invalid:ring-0 focus-visible:aria-invalid:ring-[3px]"
                  id="password"
                  type="password"
                />
                {failure ? <FieldError>{t(`login.error.${failure}`)}</FieldError> : null}
              </Field>
              <Button loading={formState.isSubmitting} type="submit">
                {t('login.submit')}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </FullScreenLayout>
  )
}
