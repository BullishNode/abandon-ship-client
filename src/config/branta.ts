import { BrantaServerBaseUrl, V2BrantaClient } from '@branta-ops/branta'

export const brantaClient = new V2BrantaClient({
  baseUrl: BrantaServerBaseUrl.Staging,
  privacy: 'strict'
})
