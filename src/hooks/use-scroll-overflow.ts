import { useState } from 'react'
import type { RefObject } from 'react'
import { useMountEffect } from '@/hooks/use-mount-effect'

function observeChildren(observer: ResizeObserver, el: HTMLElement) {
  observer.disconnect()
  observer.observe(el)
  for (const child of el.children) {
    observer.observe(child)
  }
}

export function useScrollOverflow(ref: RefObject<HTMLElement | null>) {
  const [canScrollUp, setCanScrollUp] = useState(false)
  const [canScrollDown, setCanScrollDown] = useState(false)

  function update() {
    const el = ref.current
    if (!el) {
      return
    }
    setCanScrollUp(el.scrollTop > 0)
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 4)
  }

  useMountEffect(() => {
    const el = ref.current
    const resizeObserver = new ResizeObserver(update)
    const mutationObserver = new MutationObserver(() => {
      if (el) {
        observeChildren(resizeObserver, el)
        update()
      }
    })

    if (el) {
      update()
      observeChildren(resizeObserver, el)
      mutationObserver.observe(el, { childList: true })
    }

    return () => {
      resizeObserver.disconnect()
      mutationObserver.disconnect()
    }
  })

  return { canScrollDown, canScrollUp, update }
}
