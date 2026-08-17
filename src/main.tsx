import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { config as configureZod } from 'zod'
import './index.css'
import './i18n'
import { AuthGate } from './components/auth-gate'
import { ErrorBoundary } from './components/error-boundary'
import { FullScreenLayout } from './components/full-screen-layout'
import { LoadingScreen } from './components/loading-screen'
import { initConfig } from './config/runtime'
import { fetchAuthStatus } from './lib/auth-api'
import { queryClient } from './lib/query-client'
import { useAuthStore } from './stores/auth'
import type { AuthStatus } from './types/auth'

configureZod({ jitless: true })

const root = document.querySelector('#root')
if (!root) {
  throw new Error('Root element not found')
}

// After an update replaces the hashed assets, chunks referenced by an
// already-loaded page 404. One reload fetches the fresh index.html; the
// session flag keeps a genuine failure from reloading in a loop.
const CHUNK_RELOAD_FLAG = 'bark-web:chunk-reload'
let reloadingForFreshAssets = false

window.addEventListener('vite:preloadError', () => {
  if (sessionStorage.getItem(CHUNK_RELOAD_FLAG) !== null) {
    return
  }
  sessionStorage.setItem(CHUNK_RELOAD_FLAG, '1')
  reloadingForFreshAssets = true
  window.location.reload()
})

const CONFIG_RETRY_DELAYS_MS = [0, 250, 500, 1000, 2000, 4000]

async function delay(ms: number): Promise<void> {
  // oxlint-disable-next-line promise/avoid-new, eslint/no-promise-executor-return
  return await new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function initConfigWithRetry(): Promise<void> {
  let lastError: unknown
  for (const ms of CONFIG_RETRY_DELAYS_MS) {
    if (ms > 0) {
      await delay(ms)
    }
    try {
      await initConfig()
      return
    } catch (error: unknown) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Failed to load config')
}

function BootError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <FullScreenLayout>
      <div className="flex flex-col items-center justify-center gap-4 text-center">
        <p className="font-medium text-foreground text-lg">Failed to load app</p>
        <p className="max-w-md text-muted-foreground text-sm">{message}</p>
        <button
          className="rounded-md border border-border px-4 py-2 font-medium text-sm hover:bg-accent"
          onClick={onRetry}
          type="button"
        >
          Retry
        </button>
      </div>
    </FullScreenLayout>
  )
}

// In WASM mode the "auth gate" guards seed re-entry: a wallet persisted in
// IndexedDB whose in-memory seed was lost on reload is locked until it can be
// reopened. Passwordless wallets reopen silently from the device vault; only
// when that fails (password set, vault missing, private mode) does the gate
// prompt for the password or the phrase. In barkd mode it reflects the
// daemon's auth status. The WASM module is dynamically imported so it never
// enters the barkd bundle.
async function resolveInitialAuthStatus(): Promise<AuthStatus> {
  if (__BACKEND__ === 'wasm') {
    const { isWalletLocked, tryDeviceUnlock } = await import('./lib/backend/wasm')
    if (!(await isWalletLocked())) {
      return { authRequired: false, authed: true }
    }
    const unlock = await tryDeviceUnlock()
    if (unlock.status === 'unlocked') {
      return { authRequired: false, authed: true }
    }
    if (unlock.status === 'failed') {
      console.error('Silent unlock failed', unlock.error)
    }
    return {
      authRequired: true,
      authed: false,
      deviceUnlockFailed: unlock.status === 'failed'
    }
  }
  return await fetchAuthStatus()
}

async function bootstrap(reactRoot: Root): Promise<void> {
  reactRoot.render(<LoadingScreen />)
  try {
    await initConfigWithRetry()

    useAuthStore.getState().setStatus(await resolveInitialAuthStatus())

    const { default: App } = await import('./App.tsx')

    reactRoot.render(
      <StrictMode>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <AuthGate>
              <App />
            </AuthGate>
          </QueryClientProvider>
        </ErrorBoundary>
      </StrictMode>
    )
  } catch (error: unknown) {
    console.error('Failed to bootstrap app', error)
    if (reloadingForFreshAssets) {
      return
    }
    const message = error instanceof Error ? error.message : 'Unknown error during startup.'
    reactRoot.render(<BootError message={message} onRetry={() => window.location.reload()} />)
  }
}

const reactRoot = createRoot(root)
void bootstrap(reactRoot)
