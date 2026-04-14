/// <reference types="vite/client" />

import type { ImportMetaEnvAugmented } from '@julr/vite-plugin-validate-env'
import type envConfig from './lib/env'

type AugmentedEnv = ImportMetaEnvAugmented<typeof envConfig>

interface ViteTypeOptions {
  strictImportMetaEnv: unknown
}

interface ImportMetaEnv extends AugmentedEnv {}
