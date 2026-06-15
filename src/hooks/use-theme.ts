import { useEffect } from 'react'
import { applyResolvedTheme, watchSystemTheme } from '@/lib/theme'
import { useSettingsStore } from '@/stores/settings'

export function useTheme() {
  const theme = useSettingsStore((state) => state.theme)

  useEffect(() => {
    applyResolvedTheme(theme)
    const cleanup =
      theme === 'system'
        ? watchSystemTheme(() => {
            applyResolvedTheme('system')
          })
        : undefined
    return cleanup
  }, [theme])
}
