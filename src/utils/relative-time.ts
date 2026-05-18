const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY
const MONTH = 30 * DAY
const YEAR = 365 * DAY

const divisions: { amount: number; divisor: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: MINUTE, divisor: SECOND, unit: 'second' },
  { amount: HOUR, divisor: MINUTE, unit: 'minute' },
  { amount: DAY, divisor: HOUR, unit: 'hour' },
  { amount: WEEK, divisor: DAY, unit: 'day' },
  { amount: MONTH, divisor: WEEK, unit: 'week' },
  { amount: YEAR, divisor: MONTH, unit: 'month' },
  { amount: Number.POSITIVE_INFINITY, divisor: YEAR, unit: 'year' }
]

const relativeFormatters = new Map<string | undefined, Intl.RelativeTimeFormat>()
const dateTimeFormatters = new Map<string | undefined, Intl.DateTimeFormat>()

function getRelativeFormatter(locale?: string): Intl.RelativeTimeFormat {
  const cached = relativeFormatters.get(locale)
  if (cached) {
    return cached
  }
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  relativeFormatters.set(locale, formatter)
  return formatter
}

function getDateTimeFormatter(locale?: string): Intl.DateTimeFormat {
  const cached = dateTimeFormatters.get(locale)
  if (cached) {
    return cached
  }
  const formatter = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
  dateTimeFormatters.set(locale, formatter)
  return formatter
}

export function formatRelativeTime(date: Date, locale?: string): string {
  const formatter = getRelativeFormatter(locale)
  const elapsed = date.getTime() - Date.now()

  for (const { amount, divisor, unit } of divisions) {
    if (Math.abs(elapsed) < amount) {
      return formatter.format(Math.round(elapsed / divisor), unit)
    }
  }

  return formatter.format(Math.round(elapsed / YEAR), 'year')
}

export function formatAbsoluteDateTime(date: Date, locale?: string): string {
  return getDateTimeFormatter(locale).format(date)
}
