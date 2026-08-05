import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { WasmPasswordDialog } from '@/components/wasm-password-dialog'
import type { WasmPasswordMode, WasmPasswordSubmit } from '@/components/wasm-password-dialog'
import { Button } from '@/components/ui/button'
import { Field, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field'
import {
  useChangeWalletPassword,
  useRemoveWalletPassword,
  useSetWalletPassword
} from '@/hooks/use-wallet-password'
// Static import of the WASM vault: reachable only through the settings page's
// __BACKEND__-guarded lazy import, so it stays out of barkd bundles.
import { hasVault, InvalidPasswordError } from '@/lib/backend/wasm'

const SUCCESS_KEY: Record<WasmPasswordMode, string> = {
  change: 'settings.password.dialog.change_success',
  remove: 'settings.password.dialog.remove_success',
  set: 'settings.password.dialog.set_success'
}

export default function WasmSecuritySettings() {
  const { t } = useTranslation()
  const [hasPassword, setHasPassword] = useState(hasVault)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [mode, setMode] = useState<WasmPasswordMode>('set')
  const [invalidCurrent, setInvalidCurrent] = useState(false)

  const setPassword = useSetWalletPassword()
  const changePassword = useChangeWalletPassword()
  const removePassword = useRemoveWalletPassword()

  const isPending = setPassword.isPending || changePassword.isPending || removePassword.isPending

  function openDialog(nextMode: WasmPasswordMode) {
    setMode(nextMode)
    setInvalidCurrent(false)
    setDialogOpen(true)
  }

  function handleSuccess(nextMode: WasmPasswordMode) {
    setHasPassword(hasVault())
    setDialogOpen(false)
    toast.success(t(SUCCESS_KEY[nextMode]))
  }

  function handleError(error: unknown) {
    if (error instanceof InvalidPasswordError) {
      setInvalidCurrent(true)
      return
    }
    toast.error(t('settings.password.dialog.error_generic'))
  }

  function handleSubmit(values: WasmPasswordSubmit) {
    const options = {
      onError: handleError,
      onSuccess: () => handleSuccess(mode)
    }
    if (mode === 'set' && values.next !== undefined) {
      setPassword.mutate(values.next, options)
      return
    }
    if (mode === 'change' && values.current !== undefined && values.next !== undefined) {
      changePassword.mutate({ current: values.current, next: values.next }, options)
      return
    }
    if (mode === 'remove' && values.current !== undefined) {
      removePassword.mutate(values.current, options)
    }
  }

  return (
    <Field orientation="responsive">
      <FieldContent>
        <FieldLabel>{t('settings.password.label')}</FieldLabel>
        <FieldDescription>{t('settings.password.description')}</FieldDescription>
      </FieldContent>
      {hasPassword ? (
        <div className="flex gap-2">
          <Button onClick={() => openDialog('change')} variant="outline">
            {t('settings.password.change_button')}
          </Button>
          <Button onClick={() => openDialog('remove')} variant="outline">
            {t('settings.password.remove_button')}
          </Button>
        </div>
      ) : (
        <Button onClick={() => openDialog('set')} variant="outline">
          {t('settings.password.set_button')}
        </Button>
      )}
      <WasmPasswordDialog
        invalidCurrent={invalidCurrent}
        isPending={isPending}
        mode={mode}
        onClearInvalid={() => setInvalidCurrent(false)}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        open={dialogOpen}
      />
    </Field>
  )
}
