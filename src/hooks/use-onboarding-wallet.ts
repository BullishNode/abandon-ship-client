import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useCreateWallet } from '@/hooks/barkd/use-create-wallet'
import { persistOnboardingPassword } from '@/lib/onboarding-password'

interface OnboardingWalletParams {
  name: string
  mnemonic: string
  // Empty when the user skipped the password step (or the backend has none).
  password: string
  birthdayHeight?: number
  restore?: boolean
}

interface OnboardingWalletOutcome {
  passwordSaved: boolean
  scanIncomplete: boolean
}

// A password that fails to persist is reported but does not fail the flow: the
// wallet already exists at that point and stays reachable passwordless, rather
// than leaving the user stranded on the form. The same holds for a failed
// restore-time onchain scan: the wallet is valid, only pre-existing history may
// be missing, so it is a warning rather than a failure.
export function useOnboardingWallet() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { mutateAsync: createWallet } = useCreateWallet()

  return useMutation({
    mutationFn: async ({
      password,
      ...params
    }: OnboardingWalletParams): Promise<OnboardingWalletOutcome> => {
      const { created, scanIncomplete } = await createWallet({ ...params, createdAt: new Date() })
      if (!created) {
        throw new Error(t('errors.create_wallet_failed'))
      }
      if (password.length === 0) {
        return { passwordSaved: true, scanIncomplete }
      }
      try {
        await persistOnboardingPassword(password)
        return { passwordSaved: true, scanIncomplete }
      } catch {
        return { passwordSaved: false, scanIncomplete }
      }
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
    onSuccess: async ({ passwordSaved, scanIncomplete }) => {
      if (!passwordSaved) {
        toast.error(t('wallet.password.error_save'))
      }
      if (scanIncomplete) {
        toast.warning(t('wallet.mnemonic.import.scan_incomplete'))
      }
      await navigate('/dashboard')
    }
  })
}
