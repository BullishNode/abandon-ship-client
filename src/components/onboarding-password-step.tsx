import { useTranslation } from 'react-i18next'
import { StepsLayoutContent } from '@/components/layout/steps-layout'
import { NewPasswordFields } from '@/components/new-password-fields'
import { FieldDescription, FieldGroup } from '@/components/ui/field'
import { useSilentUnlockSupported } from '@/hooks/use-silent-unlock-supported'

interface OnboardingPasswordStepProps {
  password: string
  confirm: string
  disabled?: boolean
  onPasswordChange: (value: string) => void
  onConfirmChange: (value: string) => void
}

// The password is held by the flow rather than react-hook-form so Skip can drop
// it without unregistering fields.
export function OnboardingPasswordStep({
  password,
  confirm,
  disabled = false,
  onPasswordChange,
  onConfirmChange
}: OnboardingPasswordStepProps) {
  const { t } = useTranslation()
  const { data: silentUnlockSupported } = useSilentUnlockSupported()

  return (
    <StepsLayoutContent
      description={t('wallet.password.description')}
      title={t('wallet.password.title')}
    >
      <FieldGroup>
        <NewPasswordFields
          confirm={confirm}
          confirmLabel={t('wallet.password.confirm_label')}
          disabled={disabled}
          idPrefix="onboarding"
          mismatchError={t('wallet.password.error_mismatch')}
          newLabel={t('wallet.password.label')}
          next={password}
          onConfirmChange={onConfirmChange}
          onNextChange={onPasswordChange}
        />
        {silentUnlockSupported === false ? (
          <FieldDescription>{t('wallet.password.no_silent_unlock')}</FieldDescription>
        ) : null}
      </FieldGroup>
    </StepsLayoutContent>
  )
}
