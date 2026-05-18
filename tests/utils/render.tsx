import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { RenderOptions } from '@testing-library/react'
import { render } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter } from 'react-router-dom'
import i18n from 'i18next'

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { gcTime: Number.POSITIVE_INFINITY, retry: false, staleTime: 0 }
    }
  })
}

interface WrapperOptions {
  queryClient?: QueryClient
  initialEntries?: string[]
}

interface ProvidersProps extends WrapperOptions {
  children: ReactNode
}

export function TestProviders({ children, initialEntries = ['/'], queryClient }: ProvidersProps) {
  const client = queryClient ?? createTestQueryClient()
  return (
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>
  )
}

export function renderWithProviders(
  ui: ReactElement,
  options: WrapperOptions & Omit<RenderOptions, 'wrapper'> = {}
) {
  const { initialEntries, queryClient, ...rest } = options
  return render(ui, {
    wrapper: ({ children }) => (
      <TestProviders initialEntries={initialEntries} queryClient={queryClient}>
        {children}
      </TestProviders>
    ),
    ...rest
  })
}
