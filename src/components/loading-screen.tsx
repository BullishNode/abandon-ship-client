import { FullScreenLayout } from '@/components/full-screen-layout'
import { Spinner } from '@/components/ui/spinner'

interface LoadingScreenProps {
  text?: string
}

export function LoadingScreen({ text = 'Loading...' }: LoadingScreenProps) {
  return (
    <FullScreenLayout>
      <div className="flex flex-col items-center justify-center gap-4">
        <Spinner className="size-8" />
        <p className="text-muted-foreground text-sm">{text}</p>
      </div>
    </FullScreenLayout>
  )
}
