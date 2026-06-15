import type { ResolvedTheme, Theme } from '@/types/theme'

const DARK_CLASS = 'dark'
const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)'

export function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === 'system') {
    return window.matchMedia(DARK_MEDIA_QUERY).matches ? 'dark' : 'light'
  }
  return theme
}

export function applyResolvedTheme(theme: Theme): void {
  document.documentElement.classList.toggle(DARK_CLASS, resolveTheme(theme) === 'dark')
}

export function watchSystemTheme(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_MEDIA_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}
