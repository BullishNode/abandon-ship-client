import { Spinner } from '@/components/ui/spinner'

interface LoadingScreenProps {
  text?: string
}

export function LoadingScreen({ text = 'Loading your wallet' }: LoadingScreenProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <Spinner className="size-8" />
      <p className="text-muted-foreground text-sm">{text}</p>
    </div>
  )
}
