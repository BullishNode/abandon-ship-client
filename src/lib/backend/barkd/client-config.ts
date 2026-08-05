import { Configuration } from '@secondts/barkd'
import { useAuthStore } from '@/stores/auth'

const UNAUTHORIZED = 401

const authMiddleware = {
  // oxlint-disable-next-line require-await
  post: async ({ response }: { response: Response }): Promise<Response> => {
    const { authRequired, setStatus } = useAuthStore.getState()
    if (response.status === UNAUTHORIZED && authRequired) {
      setStatus({ authRequired: true, authed: false })
    }
    return response
  }
}

declare global {
  interface Window {
    __BARKD__?: { token?: string }
  }
}

// When barkd serves this SPA itself (embedded build), it injects its bearer
// token via `window.__BARKD__.token` (see the `<!--barkd-token-->` marker in
// index.html). In the proxied dev/docker flows nothing is injected and the
// proxy adds the bearer server-side, so this returns undefined and the client
// sends no Authorization header of its own.
function injectedToken(): string | undefined {
  const token = window.__BARKD__?.token
  return token !== undefined && token.length > 0 ? token : undefined
}

const token = injectedToken()

export const clientConfig = new Configuration({
  basePath: '/api/barkd',
  credentials: 'same-origin',
  headers: { 'X-Requested-With': 'bark' },
  middleware: [authMiddleware],
  ...(token === undefined ? {} : { accessToken: token })
})
