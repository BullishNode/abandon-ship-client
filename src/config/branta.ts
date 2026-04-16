import { BrantaServerBaseUrl, V2BrantaClient } from '@branta-ops/branta'

export const brantaClient = new V2BrantaClient({
  baseUrl:
    import.meta.env.MODE === 'production'
      ? BrantaServerBaseUrl.Production
      : BrantaServerBaseUrl.Staging,
  privacy: 'strict'
})
