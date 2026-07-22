import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { isHttpsUrl } from '@/utils/url'

interface BrantaPayment {
  platform?: string
  platformLogoUrl?: string
  platformLogoLightUrl?: string
}

interface BrantaVerificationStatusProps {
  payment: BrantaPayment | undefined
  verifyUrl: string | undefined
}

export function BrantaVerificationStatus({ payment, verifyUrl }: BrantaVerificationStatusProps) {
  const { t } = useTranslation()
  const [imageLoaded, setImageLoaded] = useState(false)
  if (payment === undefined) {
    return null
  }
  const logoUrl = payment.platformLogoLightUrl ?? payment.platformLogoUrl
  const hasLogo = isHttpsUrl(logoUrl)
  const showLogoSkeleton = hasLogo && !imageLoaded
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
      {t('send.branta.title')}:
      <a
        className="inline-flex items-center gap-1 align-middle"
        href={isHttpsUrl(verifyUrl) ? verifyUrl : undefined}
        rel="noopener"
        target="_blank"
      >
        {showLogoSkeleton && <Skeleton className="h-4 w-4 rounded-[2px]" />}
        {hasLogo && (
          <img
            alt={payment.platform ?? ''}
            className={cn(
              'inline-block h-4 w-auto rounded-[2px] object-contain',
              showLogoSkeleton && 'hidden'
            )}
            onLoad={() => setImageLoaded(true)}
            src={logoUrl}
          />
        )}
        {payment.platform}
      </a>
    </span>
  )
}
