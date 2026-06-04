import { fileURLToPath } from 'node:url'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import type { Plugin, ProxyOptions } from 'vite'
import { defineConfig } from 'vitest/config'

const DEFAULT_API_TARGET = 'http://localhost:4001'
const DEFAULT_BARKD_TARGET = 'http://localhost:4000'
const BARKD_PREFIX = /^\/api\/barkd/u
const WS_PREFIX = /^\/barkd-ws/u

type Env = Record<string, string | undefined>

// Bring-your-own-barkd: serve runtime config from env vars so the Hono api
// process is not needed in this dev flow.
function byobConfigPlugin(env: Env): Plugin {
  return {
    configureServer(server) {
      server.middlewares.use('/api/config', (req, res, next) => {
        if (req.method !== 'GET') {
          next()
          return
        }
        res.setHeader('Content-Type', 'application/json')
        res.end(
          JSON.stringify({
            arkServer: env.ARK_SERVER ?? '',
            chainSource: env.CHAIN_SOURCE ?? '',
            network: env.BARK_NETWORK ?? 'signet'
          })
        )
      })
    },
    name: 'byob-config'
  }
}

// Bring-your-own-barkd: proxy straight to the user's barkd, injecting the
// bearer token server-side so it never reaches the browser.
function byobProxy(env: Env): Record<string, ProxyOptions> {
  const barkdTarget = env.BARKD_URL ?? DEFAULT_BARKD_TARGET
  const token = env.BARKD_AUTH_TOKEN ?? ''
  return {
    '/api/barkd': {
      changeOrigin: true,
      configure: (proxy) => {
        proxy.on('proxyReq', (proxyReq) => {
          if (token.length > 0) {
            proxyReq.setHeader('authorization', `Bearer ${token}`)
          }
        })
      },
      rewrite: (path) => path.replace(BARKD_PREFIX, ''),
      target: barkdTarget
    },
    '/barkd-ws': {
      changeOrigin: true,
      rewrite: (path) => path.replace(WS_PREFIX, ''),
      target: barkdTarget,
      ws: true
    }
  }
}

function defaultProxy(): Record<string, ProxyOptions> {
  const apiTarget = process.env.VITE_DEV_API_TARGET ?? DEFAULT_API_TARGET
  const barkdTarget = process.env.VITE_DEV_BARKD_TARGET ?? DEFAULT_BARKD_TARGET
  return {
    '/api': {
      changeOrigin: true,
      target: apiTarget
    },
    '/barkd-ws': {
      changeOrigin: true,
      rewrite: (path) => path.replace(WS_PREFIX, ''),
      target: barkdTarget,
      ws: true
    }
  }
}

export default defineConfig(({ mode }) => {
  const isByob = mode === 'byob'
  const env: Env = { ...process.env, ...loadEnv(mode, process.cwd(), '') }
  return {
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss(),
      ...(isByob ? [byobConfigPlugin(env)] : [])
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('src', import.meta.url))
      }
    },
    server: {
      host: true,
      port: 5173,
      proxy: isByob ? byobProxy(env) : defaultProxy(),
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
  }
})
