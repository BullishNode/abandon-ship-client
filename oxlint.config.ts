import { defineConfig } from 'oxlint'

import core from 'ultracite/oxlint/core'
import react from 'ultracite/oxlint/react'
import vitest from 'ultracite/oxlint/vitest'

export default defineConfig({
  extends: [core, react, vitest],
  ignorePatterns: ['.claude/skills', 'src/components/ui', 'scripts/compose.mjs'],
  overrides: [
    {
      files: ['**/*.tsx'],
      rules: {
        '@typescript-eslint/no-confusing-void-expression': 'off',
        'no-use-before-define': 'off'
      }
    },
    {
      files: ['src/main.tsx'],
      rules: {
        'import/no-named-as-default': 'off'
      }
    },
    {
      files: ['src/App.tsx'],
      rules: {
        'unicorn/filename-case': 'off'
      }
    },
    {
      files: ['src/i18n/index.ts'],
      rules: {
        'import/no-named-as-default-member': 'off'
      }
    },
    {
      files: ['src/vite-env.d.ts'],
      rules: {
        '@typescript-eslint/no-empty-interface': 'off',
        '@typescript-eslint/no-empty-object-type': 'off'
      }
    },
    {
      files: ['tests/**', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
      rules: {
        '@typescript-eslint/unbound-method': 'off',
        'import/no-named-as-default-member': 'off'
      }
    },
    {
      files: ['**/*.{test,spec}.{ts,tsx,js,jsx}', '**/__tests__/**/*.{ts,tsx,js,jsx}'],
      plugins: ['vitest'],
      rules: {
        'vitest/max-expects': ['error', { max: 10 }]
      }
    }
  ],
  rules: {
    '@typescript-eslint/no-unsafe-assignment': 'off',
    complexity: 'off',
    'func-style': ['error', 'declaration']
  }
})
