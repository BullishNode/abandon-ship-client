import { Component } from 'react'
import type { ReactNode } from 'react'
import { FullScreenLayout } from '@/components/full-screen-layout'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  message: string
}

const INITIAL_STATE: ErrorBoundaryState = { hasError: false, message: '' }

function reloadApp(): void {
  window.location.reload()
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = INITIAL_STATE

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message = error instanceof Error ? error.message : 'Unknown error.'
    return { hasError: true, message }
  }

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <FullScreenLayout>
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          <p className="font-medium text-foreground text-lg">Something went wrong</p>
          <p className="max-w-md text-muted-foreground text-sm">{this.state.message}</p>
          <button
            className="rounded-md border border-border px-4 py-2 font-medium text-sm hover:bg-accent"
            onClick={reloadApp}
            type="button"
          >
            Reload app
          </button>
        </div>
      </FullScreenLayout>
    )
  }
}
