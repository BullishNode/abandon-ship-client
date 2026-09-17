import { Configuration } from '@secondts/barkd'
import type { FetchParams, Middleware, RequestContext, ResponseContext } from '@secondts/barkd'
import { handleUnauthorized, withAuthToken } from '@/lib/backend/barkd/authed-fetch'

export const authMiddleware: Middleware = {
  // oxlint-disable-next-line require-await
  post: async ({ response }: ResponseContext): Promise<Response> => {
    handleUnauthorized(response)
    return response
  },
  // oxlint-disable-next-line require-await
  pre: async ({ init, url }: RequestContext): Promise<FetchParams> => ({
    init: withAuthToken(init),
    url
  })
}

export const clientConfig = new Configuration({
  basePath: '/api/barkd',
  credentials: 'same-origin',
  headers: { 'X-Requested-With': 'bark' },
  middleware: [authMiddleware]
})
