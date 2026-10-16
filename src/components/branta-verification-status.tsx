import type { Payment } from '@branta-ops/branta/v2'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/skeleton'
import { BRANTA_ORIGIN } from '@/config/branta-server'
import { useResolvedTheme } from '@/hooks/use-resolved-theme'
import { cn } from '@/lib/utils'
import { getBrantaLogoUrls } from '@/utils/branta'
import { isHttpsUrl } from '@/utils/url'

interface BrantaVerificationStatusProps {
  payment: Payment | undefined
  verifyUrl: string | undefined
}

export function BrantaVerificationStatus({ payment, verifyUrl }: BrantaVerificationStatusProps) {
  const { t } = useTranslation()
  const theme = useResolvedTheme()
  if (payment === undefined) {
    return null
  }
  const logoUrls = getBrantaLogoUrls(payment, theme, BRANTA_ORIGIN)
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
      {t('send.branta.title')}:
      <a
        className="inline-flex items-center gap-1 align-middle"
        href={isHttpsUrl(verifyUrl) ? verifyUrl : undefined}
        rel="noopener"
        target="_blank"
      >
        {logoUrls.length > 0 && <BrantaLogo key={logoUrls.join(' ')} urls={logoUrls} />}
        {payment.platform}
      </a>
    </span>
  )
}

interface BrantaLogoProps {
  urls: string[]
}

function BrantaLogo({ urls }: BrantaLogoProps) {
  const [attempt, setAttempt] = useState(0)
  const [isLoaded, setIsLoaded] = useState(false)
  const src = urls.at(attempt)
  if (src === undefined) {
    return null
  }
  return (
    <>
      {!isLoaded && <Skeleton className="h-4 w-4 rounded-[2px]" />}
      <img
        alt=""
        className={cn(
          'inline-block h-4 w-auto rounded-[2px] object-contain',
          !isLoaded && 'hidden'
        )}
        onError={() => setAttempt(attempt + 1)}
        onLoad={() => setIsLoaded(true)}
        referrerPolicy="no-referrer"
        src={src}
      />
    </>
  )
}
