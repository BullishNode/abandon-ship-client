import { Scanner } from '@yudiel/react-qr-scanner'
import { cn } from '@/lib/utils'

interface QRScannerProps {
  onScan: (result: string) => void
  onError?: (error: unknown) => void
  className?: string
}

export function QRScanner({ onScan, onError, className }: QRScannerProps) {
  return (
    <div
      className={cn('relative w-full overflow-hidden rounded-lg', className)}
    >
      <Scanner
        components={{ finder: false }}
        onError={onError}
        onScan={(results) => {
          const first = results[0]
          if (first) {
            onScan(first.rawValue)
          }
        }}
        styles={{
          container: { width: '100%', height: '100%' },
          video: { width: '100%', height: '100%', objectFit: 'cover' }
        }}
      />
    </div>
  )
}
