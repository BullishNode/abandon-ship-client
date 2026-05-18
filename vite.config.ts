import { fileURLToPath } from 'node:url'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const DEV_API_TARGET = process.env.VITE_DEV_API_TARGET ?? 'http://localhost:4001'
const DEV_BARKD_TARGET = process.env.VITE_DEV_BARKD_TARGET ?? 'http://localhost:4000'

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('src', import.meta.url))
    }
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        changeOrigin: true,
        target: DEV_API_TARGET
      },
      '/barkd-ws': {
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/barkd-ws/u, ''),
        target: DEV_BARKD_TARGET,
        ws: true
      }
    },
    watch: {
      usePolling: true
    }
  },
  test: {
    coverage: {
      exclude: [
        'src/**/*.d.ts',
        'src/types/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/i18n/**',
        'src/components/ui/**',
        'src/**/*.test.{ts,tsx}'
      ],
      include: ['src/**/*.{ts,tsx}'],
      provider: 'v8',
      reporter: ['text', 'html']
    },
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts']
  }
})
