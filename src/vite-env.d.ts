/// <reference types="vite/client" />

// Backend selected at build time via Vite `define` (see vite.config.ts).
// 'barkd' = REST daemon (default). 'wasm' = in-browser wallet.
declare const __BACKEND__: 'barkd' | 'wasm'

// Build-time runtime config for the WASM backend, or null in barkd builds.
declare const __WASM_CONFIG__: {
  arkServer: string
  chainSource: string
  network: string
} | null
