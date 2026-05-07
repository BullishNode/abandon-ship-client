import { measureNaturalWidth, prepareWithSegments } from '@chenglou/pretext'

const ELLIPSIS = '…'

function widthOf(text: string, font: string): number {
  return measureNaturalWidth(prepareWithSegments(text, font))
}

export function truncateMiddle(text: string, font: string, maxWidth: number): string {
  if (maxWidth <= 0 || font === '') {
    return text
  }
  if (widthOf(text, font) <= maxWidth) {
    return text
  }

  let lo = 0
  let hi = Math.floor(text.length / 2)
  let best = 0

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    const candidate = text.slice(0, mid) + ELLIPSIS + text.slice(text.length - mid)
    if (widthOf(candidate, font) <= maxWidth) {
      best = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  if (best === 0) {
    return ELLIPSIS
  }
  return text.slice(0, best) + ELLIPSIS + text.slice(text.length - best)
}
