import { Scanner } from '@yudiel/react-qr-scanner'
import { useVideoStreamReady } from '@/hooks/use-video-stream-ready'
import { cn } from '@/lib/utils'

interface QRScannerProps {
  onScan: (result: string) => void
  onError?: (error: unknown) => void
  className?: string
}

export function QRScanner({ onScan, onError, className }: QRScannerProps) {
  const { containerRef, ready } = useVideoStreamReady()

  return (
    <div className={cn('relative w-full overflow-hidden rounded-lg', className)} ref={containerRef}>
      {!ready && <div className="absolute inset-0 z-10 animate-pulse rounded-lg bg-muted" />}
      <Scanner
        components={{ finder: false }}
        onError={onError}
        sound={false}
        onScan={(results) => {
          const [first] = results
          if (first !== undefined) {
            onScan(first.rawValue)
          }
        }}
        styles={{
          container: { height: '100%', width: '100%' },
          video: { height: '100%', objectFit: 'cover', width: '100%' }
        }}
      />
    </div>
  )
}
