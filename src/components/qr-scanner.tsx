import { Scanner } from '@yudiel/react-qr-scanner'
import { useCameraReady } from '@/hooks/use-camera-ready'
import { cn } from '@/lib/utils'

interface QRScannerProps {
  onScan: (result: string) => void
  onError?: (error: unknown) => void
  className?: string
}

export function QRScanner({ onScan, onError, className }: QRScannerProps) {
  const cameraReady = useCameraReady()

  return (
    <div className={cn('relative w-full overflow-hidden rounded-lg', className)}>
      {!cameraReady && <div className="absolute inset-0 z-10 animate-pulse rounded-lg bg-muted" />}
      <Scanner
        components={{ finder: false }}
        onError={onError}
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
