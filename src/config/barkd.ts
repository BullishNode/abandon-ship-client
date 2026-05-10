import { Configuration } from '@secondts/barkd'

export const config = {
  arkServer: import.meta.env.VITE_ARK_SERVER,
  chainSource: import.meta.env.VITE_CHAIN_SOURCE,
  client: new Configuration({
    accessToken: import.meta.env.VITE_BARKD_TOKEN,
    basePath: import.meta.env.VITE_BARKD_URL
  }),
  network: import.meta.env.VITE_BARK_NETWORK
}
