'use client'

import { ChartLineIcon } from '@phosphor-icons/react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { config } from '@/config/barkd'
import { useBitcoinTip } from '@/hooks/barkd/use-bitcoin-tip'
import { useOnchainBalance } from '@/hooks/barkd/use-onchain-balance'
import { useOnchainTransactions } from '@/hooks/barkd/use-onchain-transactions'
import { useOnchainUtxos } from '@/hooks/barkd/use-onchain-utxos'
import { useWalletBalance } from '@/hooks/barkd/use-wallet-balance'
import { useWalletTransactions } from '@/hooks/barkd/use-wallet-transactions'
import { useFormatBitcoin } from '@/hooks/use-format-bitcoin'
import { getBalanceTotals } from '@/utils/balance'
import {
  buildChartSeries,
  computeBalanceHistory,
  extractTimestampMs
} from '@/utils/balance-history'
import { buildOnchainTxEntries } from '@/utils/movements-feed'

export function BalanceChart() {
  const { t } = useTranslation()
  const [timeRange, setTimeRange] = useState('90d')
  const { data: movements = [] } = useWalletTransactions()
  const { data: balance } = useWalletBalance()
  const { data: utxos = [] } = useOnchainUtxos()
  const { data: transactions = [] } = useOnchainTransactions()
  const { data: onchainBalance } = useOnchainBalance()
  const { data: tip } = useBitcoinTip()
  const formatBitcoin = useFormatBitcoin()

  const chartConfig = {
    balanceSat: {
      color: 'var(--foreground)',
      label: t('dashboard.chart.balance')
    }
  } satisfies ChartConfig

  const { totalSat: endpointTotalSat } = getBalanceTotals(balance, onchainBalance)
  const onchainEntries = buildOnchainTxEntries(transactions, utxos, {
    network: config.network,
    tipHeight: tip?.tipHeight
  })
  const balanceHistory = computeBalanceHistory(movements, onchainEntries, endpointTotalSat)
  const { data, domainStartMs, domainEndMs, ticks } = buildChartSeries(
    balanceHistory,
    timeRange,
    endpointTotalSat
  )

  return (
    <Card className="pt-0 gap-2">
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <CardTitle>{t('dashboard.chart.title')}</CardTitle>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger
            className="hidden w-40 rounded-lg sm:ml-auto sm:flex"
            aria-label={t('dashboard.chart.select_range')}
          >
            <SelectValue placeholder={t('dashboard.chart.last_3_months')} />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="90d" className="rounded-lg">
              {t('dashboard.chart.last_3_months')}
            </SelectItem>
            <SelectItem value="30d" className="rounded-lg">
              {t('dashboard.chart.last_30_days')}
            </SelectItem>
            <SelectItem value="7d" className="rounded-lg">
              {t('dashboard.chart.last_7_days')}
            </SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {balanceHistory.points.length === 0 ? (
          <Empty className="h-62.5 border-0 py-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ChartLineIcon />
              </EmptyMedia>
              <EmptyTitle>{t('dashboard.chart.empty')}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-62.5 w-full [&_svg]:overflow-visible"
          >
            <AreaChart data={data}>
              <defs>
                <linearGradient id="fillBalance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-balanceSat)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-balanceSat)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="timestampMs"
                type="number"
                scale="time"
                domain={[domainStartMs, domainEndMs]}
                ticks={ticks}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value: number) =>
                  new Date(value).toLocaleDateString('en-US', {
                    day: 'numeric',
                    month: 'short'
                  })
                }
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value: number) => formatBitcoin(value)}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) => {
                      const ts = extractTimestampMs(payload?.[0]?.payload)
                      if (ts === undefined) {
                        return ''
                      }
                      return new Date(ts).toLocaleDateString('en-US', {
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        month: 'short'
                      })
                    }}
                    formatter={(value) => [
                      formatBitcoin(Number(value)),
                      t('dashboard.chart.balance')
                    ]}
                    indicator="dot"
                  />
                }
              />
              <Area
                dataKey="balanceSat"
                fill="url(#fillBalance)"
                stroke="var(--color-balanceSat)"
                type="stepAfter"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
