export function isHttpsUrl(value: string | undefined): value is string {
  if (value === undefined || value === '') {
    return false
  }
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}
