interface SeedWordProps {
  word: string
  position: number
}

export function SeedWord({ word, position }: SeedWordProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{position}</span>
      <span className="font-medium">{word}</span>
    </div>
  )
}
