import { Configuration } from '@secondts/barkd'

export const config = new Configuration({
  accessToken: import.meta.env.VITE_BARKD_TOKEN,
  basePath: import.meta.env.VITE_BARKD_URL
})
