const MS_PER_SECOND = 1000
const MS_PER_MINUTE = 60 * MS_PER_SECOND
const MS_PER_HOUR = 60 * MS_PER_MINUTE
const MS_PER_DAY = 24 * MS_PER_HOUR

const UNIT_TO_MS: Record<string, number> = {
  d: MS_PER_DAY,
  h: MS_PER_HOUR,
  m: MS_PER_MINUTE,
  ms: 1,
  s: MS_PER_SECOND
}

const DURATION_PATTERN = /^(\d+(?:\.\d+)?)(ms|[smhd])$/iu

export function parseDurationToMs(input: string | undefined | null): number | undefined {
  if (input === undefined || input === null || input === '') {
    return undefined
  }

  const match = DURATION_PATTERN.exec(input.trim())
  if (!match) {
    return undefined
  }

  const value = Number.parseFloat(match[1])
  const unit = match[2].toLowerCase()
  const multiplier = UNIT_TO_MS[unit]

  if (multiplier === undefined || !Number.isFinite(value)) {
    return undefined
  }

  return value * multiplier
}
