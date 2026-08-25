import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { hasPasswordMismatch, NewPasswordFields } from '@/components/new-password-fields'

export type WasmPasswordMode = 'set' | 'change' | 'remove'

export interface WasmPasswordSubmit {
  current?: string
  next?: string
}

interface WasmPasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: WasmPasswordMode
  isPending: boolean
  invalidCurrent: boolean
  onSubmit: (values: WasmPasswordSubmit) => void
  onClearInvalid: () => void
}

const TITLE_KEY: Record<WasmPasswordMode, string> = {
  change: 'settings.password.dialog.change_title',
  remove: 'settings.password.dialog.remove_title',
  set: 'settings.password.dialog.set_title'
}

const DESCRIPTION_KEY: Record<WasmPasswordMode, string> = {
  change: 'settings.password.dialog.change_description',
  remove: 'settings.password.dialog.remove_description',
  set: 'settings.password.dialog.set_description'
}

export function WasmPasswordDialog({
  open,
  onOpenChange,
  mode,
  isPending,
  invalidCurrent,
  onSubmit,
  onClearInvalid
}: WasmPasswordDialogProps) {
  const { t } = useTranslation()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [sessionOpen, setSessionOpen] = useState(open)

  // Reset fields whenever the dialog opens or closes, without an effect.
  if (open !== sessionOpen) {
    setSessionOpen(open)
    setCurrent('')
    setNext('')
    setConfirm('')
  }

  const needsCurrent = mode !== 'set'
  const needsNew = mode !== 'remove'
  const currentEmpty = needsCurrent && current.length === 0
  const nextEmpty = needsNew && next.length === 0
  const mismatch = needsNew && hasPasswordMismatch(next, confirm)
  const disableSubmit = currentEmpty || nextEmpty || mismatch

  function handleClose(nextOpen: boolean) {
    if (isPending) {
      return
    }
    onOpenChange(nextOpen)
  }

  function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    if (disableSubmit) {
      return
    }
    onSubmit({
      current: needsCurrent ? current : undefined,
      next: needsNew ? next : undefined
    })
  }

  const submitVariant = mode === 'remove' ? 'destructive' : 'default'

  return (
    <Dialog onOpenChange={handleClose} open={open}>
      <DialogContent showCloseButton={false}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t(TITLE_KEY[mode])}</DialogTitle>
            <DialogDescription>{t(DESCRIPTION_KEY[mode])}</DialogDescription>
          </DialogHeader>
          <div className="mt-6 space-y-4">
            {needsCurrent ? (
              <Field>
                <FieldLabel htmlFor="wasm-current-password">
                  {t('settings.password.dialog.current_label')}
                </FieldLabel>
                <Input
                  aria-invalid={invalidCurrent ? true : undefined}
                  autoComplete="current-password"
                  className="aria-invalid:ring-0 focus-visible:aria-invalid:ring-[3px]"
                  disabled={isPending}
                  id="wasm-current-password"
                  onChange={(event) => {
                    setCurrent(event.target.value)
                    if (invalidCurrent) {
                      onClearInvalid()
                    }
                  }}
                  type="password"
                  value={current}
                />
                {invalidCurrent ? (
                  <FieldError>{t('settings.password.dialog.error_invalid_current')}</FieldError>
                ) : null}
              </Field>
            ) : null}
            {needsNew ? (
              <NewPasswordFields
                confirm={confirm}
                confirmLabel={t('settings.password.dialog.confirm_label')}
                disabled={isPending}
                idPrefix="wasm"
                mismatchError={t('settings.password.dialog.error_mismatch')}
                newLabel={t('settings.password.dialog.new_label')}
                next={next}
                onConfirmChange={setConfirm}
                onNextChange={setNext}
              />
            ) : null}
          </div>
          <DialogFooter className="mt-6">
            <Button
              disabled={isPending}
              onClick={() => handleClose(false)}
              type="button"
              variant="outline"
            >
              {t('actions.cancel')}
            </Button>
            <Button
              disabled={disableSubmit}
              loading={isPending}
              type="submit"
              variant={submitVariant}
            >
              {t('actions.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
