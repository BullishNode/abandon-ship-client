import { useMutation } from '@tanstack/react-query'
import { connectAuthToken } from '@/lib/backend/barkd/auth-token'

// The accepted token is in localStorage once the mutation resolves, so a
// reload is enough to re-run bootstrap with it in place.
export function useConnectAuthToken() {
  return useMutation({
    mutationFn: connectAuthToken,
    onSuccess: (result) => {
      if (result.ok) {
        window.location.reload()
      }
    }
  })
}
