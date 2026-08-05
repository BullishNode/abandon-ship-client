import type { Backend } from '@/types/backend'

// Backend is selected at build time via the `__BACKEND__` Vite define. Each
// backend is pulled in through a build-time-conditional dynamic import so only
// the selected one is emitted: barkd builds drop the WASM module (and the Web
// Worker + `.wasm` asset it references), and wasm builds drop the barkd REST
// client (whose module-scope api instances would otherwise defeat treeshaking).
// A ternary (not an early-return if) because the minifier constant-folds
// `cond ? a : b` reliably, while code after an always-returning block survives;
// the unselected loader is then unused and treeshaken along with its import.
async function loadWasmBackend(): Promise<Backend> {
  const { wasmBackend } = await import('@/lib/backend/wasm')
  return wasmBackend
}

async function loadBarkdBackend(): Promise<Backend> {
  const { barkdBackend } = await import('@/lib/backend/barkd')
  return barkdBackend
}

async function selectBackend(): Promise<Backend> {
  return await (__BACKEND__ === 'wasm' ? loadWasmBackend() : loadBarkdBackend())
}

export const backend: Backend = await selectBackend()
