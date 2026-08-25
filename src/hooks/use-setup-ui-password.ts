import { useMutation } from '@tanstack/react-query'
import { setupPassword } from '@/lib/auth-api'

// The response sets the session cookie, so a reload is enough to re-run
// bootstrap with it in place.
export function useSetupUiPassword() {
  return useMutation({
    mutationFn: setupPassword,
    onSuccess: (result) => {
      if (result.ok) {
        window.location.reload()
      }
    }
  })
}
