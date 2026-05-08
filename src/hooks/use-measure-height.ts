import { useState } from 'react'

export function useMeasureHeight() {
  const [height, setHeight] = useState<number | null>(null)

  function refCallback(node: HTMLElement | null): (() => void) | undefined {
    if (node === null) {
      return undefined
    }
    const element = node
    setHeight(element.offsetHeight)

    const observer = new ResizeObserver(() => {
      setHeight(element.offsetHeight)
    })
    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }

  return [height, refCallback] as const
}
