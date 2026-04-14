import { defineConfig } from '@julr/vite-plugin-validate-env'
import { z } from 'zod'

export default defineConfig({
  schema: {
    VITE_BARKD_TOKEN: z.string(),
    VITE_BARKD_URL: z.url()
  },
  validator: 'standard'
})
