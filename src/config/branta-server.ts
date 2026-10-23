import { BrantaServerBaseUrl, BrantaServerBaseUrls } from '@branta-ops/branta'

export const BRANTA_SERVER = BrantaServerBaseUrl.Production

/** Platform logos are hosted by Branta; anything from another origin is not trusted. */
export const BRANTA_ORIGIN = new URL(BrantaServerBaseUrls[BRANTA_SERVER]).origin
