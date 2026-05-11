import { useState } from 'react'

interface ElementMetrics {
  width: number
  font: string
}

const EMPTY_METRICS: ElementMetrics = { font: '', width: 0 }

function readMetrics(node: HTMLElement): ElementMetrics {
  const computed = getComputedStyle(node)
  const rawFamily = computed.fontFamily.split(',')[0]?.trim() ?? 'sans-serif'
  const family = rawFamily.replaceAll(/^['"]|['"]$/gu, '')
  const paddingX =
    Number.parseFloat(computed.paddingLeft) + Number.parseFloat(computed.paddingRight)
  const contentWidth = node.clientWidth - paddingX
  return {
    font: `${computed.fontSize} '${family}'`,
    width: Math.max(contentWidth, 0)
  }
}

export function useElementMetrics() {
  const [metrics, setMetrics] = useState(EMPTY_METRICS)

  function refCallback(node: HTMLElement | null): (() => void) | undefined {
    if (node === null) {
      return undefined
    }
    const element = node
    setMetrics(readMetrics(element))

    const observer = new ResizeObserver(() => {
      setMetrics(readMetrics(element))
    })
    observer.observe(element)

    async function refreshAfterFonts() {
      try {
        await document.fonts.ready
        setMetrics(readMetrics(element))
      } catch {
        // fonts.ready rejection is non-fatal; metrics already initialized
      }
    }
    void refreshAfterFonts()

    return () => {
      observer.disconnect()
    }
  }

  return [metrics, refCallback] as const
}
