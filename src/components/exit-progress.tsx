import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import type { ExitProgressSummary, ExitStateType } from '@/utils/exit-progress'

const STATE_ENTRIES: { type: ExitStateType; key: string }[] = [
  { key: 'start', type: 'start' },
  { key: 'processing', type: 'processing' },
  { key: 'awaiting_delta', type: 'awaiting-delta' },
  { key: 'claimable', type: 'claimable' },
  { key: 'claim_in_progress', type: 'claim-in-progress' },
  { key: 'claimed', type: 'claimed' }
]

interface ExitProgressCardProps {
  summary: ExitProgressSummary
  destinationAddress: string | null
  isClaiming: boolean
  onClaim: () => void
  onChangeAddress: () => void
}

export function ExitProgressCard({
  summary,
  destinationAddress,
  isClaiming,
  onClaim,
  onChangeAddress
}: ExitProgressCardProps) {
  const { t } = useTranslation()
  const percent = summary.total === 0 ? 0 : Math.round((summary.claimed / summary.total) * 100)
  const canClaim = summary.claimable > 0

  return (
    <div className="space-y-4 rounded-md border bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-4">
        <p className="font-medium text-sm">
          {summary.isDone
            ? t('settings.danger.emergency_exit.progress.done')
            : t('settings.danger.emergency_exit.progress.title')}
        </p>
        <p className="text-muted-foreground text-sm">
          {t('settings.danger.emergency_exit.progress.summary', {
            claimed: summary.claimed,
            total: summary.total
          })}
        </p>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} />
      </div>
      <div className="flex flex-wrap gap-2">
        {STATE_ENTRIES.map((entry) =>
          summary.counts[entry.type] > 0 ? (
            <span
              className="rounded-full bg-background px-2 py-0.5 text-xs ring-1 ring-border"
              key={entry.type}
            >
              {t(`settings.danger.emergency_exit.states.${entry.key}`)}:{' '}
              {summary.counts[entry.type]}
            </span>
          ) : null
        )}
      </div>
      <div className="flex flex-col gap-2 border-t pt-3">
        <p className="text-muted-foreground text-xs">
          {t('settings.danger.emergency_exit.destination_label')}
        </p>
        <div className="flex items-start justify-between gap-3">
          <p className="break-all font-mono text-xs">
            {destinationAddress ?? t('settings.danger.emergency_exit.destination_missing')}
          </p>
          <Button onClick={onChangeAddress} size="xs" type="button" variant="ghost">
            {t('settings.danger.emergency_exit.change_address')}
          </Button>
        </div>
      </div>
      {canClaim ? (
        <div className="flex justify-end">
          <Button
            disabled={destinationAddress === null || destinationAddress.length === 0}
            loading={isClaiming}
            onClick={onClaim}
            variant="destructive"
          >
            {t('settings.danger.emergency_exit.claim_button', { count: summary.claimable })}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
