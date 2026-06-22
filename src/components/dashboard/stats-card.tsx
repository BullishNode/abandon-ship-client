import { Card, CardContent } from '@/components/ui/card'
import { CircularProgress } from '@/components/ui/circular-progress'
import { Separator } from '@/components/ui/separator'
import { useArkInfo } from '@/hooks/barkd/use-ark-info'
import { useBitcoinTip } from '@/hooks/barkd/use-bitcoin-tip'
import { useNextRound } from '@/hooks/barkd/use-next-round'
import { useBitcoinPrice } from '@/hooks/price/use-bitcoin-price'
import { useRoundCountdown } from '@/hooks/use-round-countdown'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/stores/settings'
import { parseDurationToMs } from '@/utils/duration'
import { formatCurrency } from '@/utils/format'

const PLACEHOLDER = '—'
const RING_SIZE = 30
const RING_STROKE = 4

type BottomMetric = 'blockHeight' | 'price'

interface StatsCardProps {
  className?: string
  bottomMetric?: BottomMetric
}

export function StatsCard({ className, bottomMetric = 'price' }: StatsCardProps) {
  const showBlockHeight = bottomMetric === 'blockHeight'
  const { data: nextRound, isLoading: isLoadingRound } = useNextRound()
  const { data: arkInfo } = useArkInfo()
  const totalMs = parseDurationToMs(arkInfo?.roundInterval)
  const countdown = useRoundCountdown(nextRound?.startTime, totalMs)
  const { data: btcPrice, isLoading: isLoadingPrice } = useBitcoinPrice({
    enabled: !showBlockHeight
  })
  const { data: tip } = useBitcoinTip({ enabled: showBlockHeight })
  const fiatCurrency = useSettingsStore((state) => state.fiatCurrency)

  const countdownLabel = isLoadingRound || !countdown ? PLACEHOLDER : countdown.label
  const priceLabel =
    isLoadingPrice || btcPrice?.currentPrice === undefined
      ? PLACEHOLDER
      : formatCurrency(btcPrice.currentPrice, fiatCurrency)
  const blockHeightLabel =
    tip?.tipHeight === undefined ? PLACEHOLDER : tip.tipHeight.toLocaleString()

  const bottomLabel = showBlockHeight ? 'Block height' : 'Bitcoin price'
  const bottomValue = showBlockHeight ? blockHeightLabel : priceLabel

  return (
    <Card className={cn('h-full lg:grid lg:grid-rows-[1fr_auto_1fr]', className)} size="sm">
      <CardContent className="flex flex-col gap-2">
        <span className="text-muted-foreground text-sm font-medium">Next round</span>
        <div className="flex items-center gap-3">
          <CircularProgress
            circleStrokeWidth={RING_STROKE}
            progressStrokeWidth={RING_STROKE}
            size={RING_SIZE}
            value={countdown?.progress ?? 0}
          />
          <span className="font-bold text-2xl">{countdownLabel}</span>
        </div>
      </CardContent>
      <Separator className="mx-4 data-[orientation=horizontal]:w-auto" />
      <CardContent className="flex flex-col gap-2">
        <span className="text-muted-foreground text-sm font-medium">{bottomLabel}</span>
        <span className="font-bold text-2xl">{bottomValue}</span>
      </CardContent>
    </Card>
  )
}
