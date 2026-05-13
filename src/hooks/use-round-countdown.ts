import { useState } from 'react'
import { useMountEffect } from './use-mount-effect'

const MS_PER_SECOND = 1000
const MS_PER_MINUTE = 60 * MS_PER_SECOND
const MS_PER_HOUR = 60 * MS_PER_MINUTE
const TICK_INTERVAL_MS = 1000

interface RoundCountdown {
  isPending: boolean
  label: string
  remainingMs: number
}

const relativeTimeFormatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: 'always',
  style: 'short'
})

function formatRemaining(remainingMs: number): RoundCountdown {
  if (remainingMs <= 0) {
    return { isPending: true, label: 'Starting...', remainingMs: 0 }
  }

  const hours = Math.floor(remainingMs / MS_PER_HOUR)
  if (hours > 0) {
    return { isPending: false, label: relativeTimeFormatter.format(hours, 'hour'), remainingMs }
  }

  if (remainingMs < MS_PER_MINUTE) {
    const seconds = Math.ceil(remainingMs / MS_PER_SECOND)
    return { isPending: false, label: relativeTimeFormatter.format(seconds, 'second'), remainingMs }
  }

  const minutes = Math.ceil(remainingMs / MS_PER_MINUTE)
  return { isPending: false, label: relativeTimeFormatter.format(minutes, 'minute'), remainingMs }
}

export function useRoundCountdown(startTime?: Date): RoundCountdown | undefined {
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

  return formatRemaining(startTime.getTime() - now)
}
