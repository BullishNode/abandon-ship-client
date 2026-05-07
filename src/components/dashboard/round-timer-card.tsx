import { ClockCountdownIcon } from '@phosphor-icons/react'
import { useNextRound } from '@/hooks/barkd/use-next-round'
import { useRoundCountdown } from '@/hooks/use-round-countdown'
import { StatCard } from './stat-card'

export function RoundTimerCard() {
  const { data: nextRound, isLoading } = useNextRound()
  const countdown = useRoundCountdown(nextRound?.startTime)

  const label = isLoading || !countdown ? '—' : countdown.label

  return (
    <StatCard icon={ClockCountdownIcon} title="Next round">
      {label}
    </StatCard>
  )
}
