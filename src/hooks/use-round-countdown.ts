import { useState } from 'react'
import { useMountEffect } from './use-mount-effect'

const MS_PER_SECOND = 1000
const MS_PER_MINUTE = 60 * MS_PER_SECOND
const MS_PER_HOUR = 60 * MS_PER_MINUTE
const TICK_INTERVAL_MS = 1000
const MAX_PROGRESS = 100

interface RoundCountdown {
  isPending: boolean
  label: string
  remainingMs: number
  progress: number
}

const relativeTimeFormatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: 'always',
  style: 'short'
})

function formatLabel(remainingMs: number): { isPending: boolean; label: string } {
  if (remainingMs <= 0) {
    return { isPending: true, label: 'Starting...' }
  }

  const hours = Math.floor(remainingMs / MS_PER_HOUR)
  if (hours > 0) {
    return { isPending: false, label: relativeTimeFormatter.format(hours, 'hour') }
  }

  if (remainingMs < MS_PER_MINUTE) {
    const seconds = Math.ceil(remainingMs / MS_PER_SECOND)
    return { isPending: false, label: relativeTimeFormatter.format(seconds, 'second') }
  }

  const minutes = Math.ceil(remainingMs / MS_PER_MINUTE)
  return { isPending: false, label: relativeTimeFormatter.format(minutes, 'minute') }
}

function computeProgress(remainingMs: number, totalMs: number | undefined): number {
  if (totalMs === undefined || totalMs <= 0) {
    return 0
  }
  const elapsedRatio = (totalMs - remainingMs) / totalMs
  const clamped = Math.min(Math.max(elapsedRatio, 0), 1)
  return clamped * MAX_PROGRESS
}

export function useRoundCountdown(startTime?: Date, totalMs?: number): RoundCountdown | undefined {
  const [now, setNow] = useState(() => Date.now())

  useMountEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now())
    }, TICK_INTERVAL_MS)

    return () => {
      clearInterval(id)
    }
  })

  if (!startTime) {
    return undefined
  }

  const remainingMs = startTime.getTime() - now
  const { isPending, label } = formatLabel(remainingMs)
  const progress = computeProgress(remainingMs, totalMs)

  return { isPending, label, progress, remainingMs }
}
