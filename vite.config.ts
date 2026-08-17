import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import type { Plugin, ProxyOptions } from 'vite'
import { defineConfig } from 'vitest/config'
import { buildChainSource } from './api/src/chain-source.ts'

const DEFAULT_API_TARGET = 'http://localhost:4001'
const DEFAULT_BARKD_TARGET = 'http://localhost:4000'
const BARKD_PREFIX = /^\/api\/barkd/u
const WS_PREFIX = /^\/barkd-ws/u

type Env = Record<string, string | undefined>

// Bring-your-own-barkd: serve runtime config from env vars so the Hono api
// process is not needed in this dev flow.
function byobConfigPlugin(env: Env): Plugin {
  const { chainSource, warnings } = buildChainSource({
    bitcoindRpcCookieFile: env.BITCOIND_RPC_COOKIE_FILE,
    bitcoindRpcUrl: env.BITCOIND_RPC_URL,
    chainSource: env.CHAIN_SOURCE
  })
  for (const warning of warnings) {
    console.warn(warning)
  }
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
            ...(chainSource === undefined ? {} : { chainSource }),
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

// WASM backend: the app talks to the ark server + esplora directly from the
// browser, so there is no Hono `/api/config`. Runtime config is baked in at
// build time from env vars (Vite `define`) instead.
function wasmConfig(env: Env): string {
  return JSON.stringify({
    arkServer: env.ARK_SERVER ?? '',
    chainSource: env.CHAIN_SOURCE ?? '',
    network: env.BARK_NETWORK ?? 'signet'
  })
}

// WASM mode ships a static site with the wallet seed in browser memory, so the
// only thing standing between an injected script and the funds is a CSP that
// forbids running attacker JS. `script-src` is the real control:
// `'wasm-unsafe-eval'` is required to instantiate the WASM module, and any
// inline scripts in index.html (the pre-paint theme bootstrap) are allowlisted
// by their sha256 hash rather than by `'unsafe-inline'`, so an injected inline
// script still cannot run. `connect-src` stays open to https/wss because
// lightning-address sends hit arbitrary user-supplied domains and price quotes
// hit third-party APIs — pinning it would break both without meaningfully
// containing an XSS (which could exfiltrate over an allowed https origin anyway).
const INLINE_SCRIPT_PATTERN = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/giu

function inlineScriptHashes(html: string): string[] {
  const hashes: string[] = []
  for (const match of html.matchAll(INLINE_SCRIPT_PATTERN)) {
    const [, body] = match
    const digest = createHash('sha256').update(body).digest('base64')
    hashes.push(`'sha256-${digest}'`)
  }
  return hashes
}

function buildWasmCsp(scriptHashes: string[]): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'wasm-unsafe-eval' ${scriptHashes.join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self' https: wss:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'"
  ].join('; ')
}

function wasmCspPlugin(): Plugin {
  return {
    name: 'wasm-csp',
    transformIndexHtml: {
      // Run after other plugins have injected their tags so the inline-script
      // hashes cover the final HTML. The bundled entry/module tags carry `src`,
      // so they are ignored by the inline-only pattern.
      handler(html) {
        return [
          {
            attrs: {
              content: buildWasmCsp(inlineScriptHashes(html)),
              'http-equiv': 'Content-Security-Policy'
            },
            injectTo: 'head-prepend',
            tag: 'meta'
          }
        ]
      },
      order: 'post'
    }
  }
}

export default defineConfig(({ mode }) => {
  const isByob = mode === 'byob'
  const isWasm = mode === 'wasm'
  const backend = isWasm ? 'wasm' : 'barkd'
  const env: Env = { ...process.env, ...loadEnv(mode, process.cwd(), '') }
  return {
    define: {
      __BACKEND__: JSON.stringify(backend),
      __WASM_CONFIG__: isWasm ? wasmConfig(env) : 'null'
    },
    // Keep the bark bindings out of dev pre-bundling: the pre-bundled copy in
    // .vite/deps resolves `new URL('..._bg.wasm', import.meta.url)` to a path
    // where no .wasm exists, so `init()` gets the SPA HTML fallback and WASM
    // instantiation fails. Serving the package as-is keeps the asset adjacent.
    optimizeDeps: {
      exclude: ['@secondts/bark']
    },
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss(),
      ...(isByob ? [byobConfigPlugin(env)] : []),
      ...(isWasm ? [wasmCspPlugin()] : [])
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
    },
    // ES-format workers so the WASM worker can `import` the bark bindings and
    // resolve `new URL('..._bg.wasm', import.meta.url)` inside its own realm.
    // The default `iife` format cannot, which strands the wasm on the main thread.
    worker: {
      format: 'es'
    }
  }
})
