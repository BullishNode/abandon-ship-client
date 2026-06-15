import { useSyncExternalStore } from 'react'
import { watchSystemTheme } from '@/lib/theme'
import { useSettingsStore } from '@/stores/settings'
import type { ResolvedTheme } from '@/types/theme'

const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)'

function getSystemPrefersDark(): boolean {
  return window.matchMedia(DARK_MEDIA_QUERY).matches
}

export function useResolvedTheme(): ResolvedTheme {
  const theme = useSettingsStore((state) => state.theme)
  const systemPrefersDark = useSyncExternalStore(watchSystemTheme, getSystemPrefersDark)
  if (theme === 'system') {
    return systemPrefersDark ? 'dark' : 'light'
  }
  return theme
}
