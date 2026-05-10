import { defineConfig } from '@julr/vite-plugin-validate-env'
import { BarkNetwork } from '@secondts/barkd'
import { z } from 'zod'

export default defineConfig({
  schema: {
    VITE_ARK_SERVER: z.url(),
    VITE_BARKD_TOKEN: z.string(),
    VITE_BARKD_URL: z.url(),
    VITE_BARK_NETWORK: z.enum(Object.values(BarkNetwork)),
    VITE_CHAIN_SOURCE: z.url()
  },
  validator: 'standard'
})
