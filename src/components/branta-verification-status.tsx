import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface BrantaPayment {
  platform?: string
  platformLogoUrl?: string
  platformLogoLightUrl?: string
}

interface BrantaVerificationStatusProps {
  isFetching: boolean
  payment: BrantaPayment | undefined
  verifyUrl: string | undefined
}

export function BrantaVerificationStatus({
  isFetching,
  payment,
  verifyUrl
}: BrantaVerificationStatusProps) {
  const { t } = useTranslation()
  const [imageLoaded, setImageLoaded] = useState(false)
  if (!isFetching && payment === undefined) {
    return null
  }
  const logoUrl = payment?.platformLogoLightUrl ?? payment?.platformLogoUrl ?? ''
  const hasLogo = logoUrl !== ''
  const isPaymentReady = payment !== undefined && (!hasLogo || imageLoaded)
  const showSkeleton = !isPaymentReady
  const showLogoSkeleton = isFetching || (hasLogo && !imageLoaded)
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
      {t('send.branta.title')}:
      {showSkeleton && (
        <>
          {showLogoSkeleton && <Skeleton className="h-4 w-4 rounded-[2px]" />}
          <Skeleton className="h-4 w-20" />
        </>
      )}
      {payment !== undefined && (
        <a
          className={cn('inline-flex items-center gap-1 align-middle', showSkeleton && 'hidden')}
          href={verifyUrl}
          rel="noopener"
          target="_blank"
        >
          {hasLogo && (
            <img
              alt={payment.platform ?? ''}
              className="inline-block h-4 w-auto rounded-[2px] object-contain"
              onLoad={() => setImageLoaded(true)}
              src={logoUrl}
            />
          )}
          {payment.platform}
        </a>
      )}
    </span>
  )
}
