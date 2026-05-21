import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import './index.css'
import { LoadingScreen } from './components/loading-screen'
import { initConfig } from './config/barkd'
import { queryClient } from './lib/query-client'

const root = document.querySelector('#root')
if (!root) {
  throw new Error('Root element not found')
}

const CONFIG_RETRY_DELAYS_MS = [0, 250, 500, 1000, 2000, 4000]

 async function delay(ms: number): Promise<void> {
  // oxlint-disable-next-line promise/avoid-new, eslint/no-promise-executor-return
  return new Promise((resolve) => {
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
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
  )
}

async function bootstrap(reactRoot: Root): Promise<void> {
  reactRoot.render(<LoadingScreen />)
  try {
    await initConfigWithRetry()
    const { default: App } = await import('./App.tsx')
    reactRoot.render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </StrictMode>
    )
  } catch (error: unknown) {
    console.error('Failed to bootstrap app', error)
    const message = error instanceof Error ? error.message : 'Unknown error during startup.'
    reactRoot.render(<BootError message={message} onRetry={() => window.location.reload()} />)
  }
}

const reactRoot = createRoot(root)
void bootstrap(reactRoot)
