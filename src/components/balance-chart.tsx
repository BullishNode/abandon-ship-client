'use client'

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useWalletBalance } from '@/hooks/barkd/use-wallet-balance'
import { useWalletTransactions } from '@/hooks/barkd/use-wallet-transactions'
import { useFormatBitcoin } from '@/hooks/use-format-bitcoin'
import { computeBalanceHistory, filterByTimeRange } from '@/utils/balance-history'

const chartConfig = {
  balanceSat: {
    color: 'var(--foreground)',
    label: 'Balance'
  }
} satisfies ChartConfig

export function BalanceChart() {
  const { t } = useTranslation()
  const [timeRange, setTimeRange] = useState('90d')
  const { data: movements = [] } = useWalletTransactions()
  const { data: balance } = useWalletBalance()
  const formatBitcoin = useFormatBitcoin()

  const currentBalanceSat = balance?.spendableSat ?? 0
  const balanceHistory = computeBalanceHistory(movements, currentBalanceSat)
  const filteredData = filterByTimeRange(balanceHistory, timeRange)

  return (
    <Card className="pt-0 gap-2">
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1">
          <CardTitle>{t('dashboard.balance_over_time', 'Balance Over Time')}</CardTitle>
          <CardDescription>
            {t('dashboard.balance_chart_description', 'Wallet balance history')}
          </CardDescription>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger
            className="hidden w-40 rounded-lg sm:ml-auto sm:flex"
            aria-label={t('dashboard.select_time_range', 'Select time range')}
          >
            <SelectValue placeholder={t('dashboard.last_3_months', 'Last 3 months')} />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="90d" className="rounded-lg">
              {t('dashboard.last_3_months', 'Last 3 months')}
            </SelectItem>
            <SelectItem value="30d" className="rounded-lg">
              {t('dashboard.last_30_days', 'Last 30 days')}
            </SelectItem>
            <SelectItem value="7d" className="rounded-lg">
              {t('dashboard.last_7_days', 'Last 7 days')}
            </SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-62.5 w-full [&_svg]:overflow-visible"
        >
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillBalance" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-balanceSat)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-balanceSat)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value: string) => {
                const date = new Date(value)
                return date.toLocaleDateString('en-US', {
                  day: 'numeric',
                  month: 'short'
                })
              }}
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
                  labelFormatter={(value) =>
                    new Date(String(value)).toLocaleDateString('en-US', {
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      month: 'short'
                    })
                  }
                  formatter={(value) => [
                    formatBitcoin(Number(value)),
                    t('dashboard.balance', 'Balance')
                  ]}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="balanceSat"
              type="natural"
              fill="url(#fillBalance)"
              stroke="var(--color-balanceSat)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
