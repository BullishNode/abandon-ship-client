import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { initConfig } from './config/barkd'
import { queryClient } from './lib/query-client'

const root = document.querySelector('#root')
if (!root) {
  throw new Error('Root element not found')
}

async function bootstrap(target: Element): Promise<void> {
  try {
    await initConfig()
    const { default: App } = await import('./App.tsx')
    createRoot(target).render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </StrictMode>
    )
  } catch (error: unknown) {
    console.error('Failed to bootstrap app', error)
    target.innerHTML =
      '<div style="padding:24px;font-family:system-ui">Failed to load app. Refresh to retry.</div>'
  }
}

void bootstrap(root)
