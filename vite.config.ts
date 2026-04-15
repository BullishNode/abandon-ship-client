import { fileURLToPath } from 'node:url'
import { ValidateEnv } from '@julr/vite-plugin-validate-env'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => ({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']]
      }
    }),
    tailwindcss(),
    mode !== 'test' && ValidateEnv({ configFile: 'src/lib/env' })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('src', import.meta.url))
    }
  },
  server: {
    host: true,
    port: 5173,
    watch: {
      usePolling: true
    }
  },
  test: {
    coverage: {
      exclude: ['src/**/*.d.ts', 'src/types/**'],
      include: ['src/**/*.ts'],
      provider: 'v8',
      reporter: ['text', 'html']
    }
  }
}))
