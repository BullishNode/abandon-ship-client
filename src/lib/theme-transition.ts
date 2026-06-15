import { applyResolvedTheme } from '@/lib/theme'
import { useSettingsStore } from '@/stores/settings'
import type { Theme } from '@/types/theme'

export function changeThemeWithTransition(theme: Theme): void {
  function apply() {
    useSettingsStore.getState().setTheme(theme)
    applyResolvedTheme(theme)
  }
  if (typeof document.startViewTransition === 'function') {
    document.startViewTransition(apply)
    return
  }
  apply()
}
