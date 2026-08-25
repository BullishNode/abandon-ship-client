import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

export function hasPasswordMismatch(next: string, confirm: string): boolean {
  return next !== confirm
}

interface NewPasswordFieldsProps {
  // Prefixes the input ids so two instances can coexist on one page.
  idPrefix: string
  next: string
  confirm: string
  newLabel: string
  confirmLabel: string
  mismatchError: string
  disabled?: boolean
  onNextChange: (value: string) => void
  onConfirmChange: (value: string) => void
}

export function NewPasswordFields({
  idPrefix,
  next,
  confirm,
  newLabel,
  confirmLabel,
  mismatchError,
  disabled = false,
  onNextChange,
  onConfirmChange
}: NewPasswordFieldsProps) {
  const mismatch = hasPasswordMismatch(next, confirm)

  return (
    <>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-new-password`}>{newLabel}</FieldLabel>
        <Input
          autoComplete="new-password"
          disabled={disabled}
          id={`${idPrefix}-new-password`}
          onChange={(event) => onNextChange(event.target.value)}
          type="password"
          value={next}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-confirm-password`}>{confirmLabel}</FieldLabel>
        <Input
          autoComplete="new-password"
          disabled={disabled}
          id={`${idPrefix}-confirm-password`}
          onChange={(event) => onConfirmChange(event.target.value)}
          type="password"
          value={confirm}
        />
        {confirm.length > 0 && mismatch ? <FieldError>{mismatchError}</FieldError> : null}
      </Field>
    </>
  )
}
