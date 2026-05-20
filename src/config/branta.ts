import { BrantaServerBaseUrl } from '@branta-ops/branta'
import { BrantaService } from '@branta-ops/branta/v2'

export const brantaClient = new BrantaService({
  baseUrl: BrantaServerBaseUrl.Production,
  privacy: 'strict'
})
