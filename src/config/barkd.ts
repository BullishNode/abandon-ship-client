import { Configuration } from '@secondts/barkd'

export const config = new Configuration({
  basePath: import.meta.env.VITE_BARKD_URL,
  accessToken: import.meta.env.VITE_BARKD_TOKEN
})
