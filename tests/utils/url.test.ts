import { describe, expect, it } from 'vitest'
import { isHttpsUrl } from '../../src/utils/url'

describe(isHttpsUrl, () => {
  it('accepts an https URL', () => {
    expect(isHttpsUrl('https://branta.pro/verify/abc')).toBeTruthy()
  })

  it('rejects an http URL', () => {
    expect(isHttpsUrl('http://branta.pro/verify/abc')).toBeFalsy()
  })

  it('rejects a javascript URI', () => {
    // oxlint-disable-next-line no-script-url
    expect(isHttpsUrl('javascript:alert(1)')).toBeFalsy()
  })

  it('rejects a data URI', () => {
    expect(isHttpsUrl('data:text/html,<script>alert(1)</script>')).toBeFalsy()
  })

  it('rejects an undefined value', () => {
    const value = ['https://example.com'].at(1)
    expect(isHttpsUrl(value)).toBeFalsy()
  })

  it('rejects an empty string', () => {
    expect(isHttpsUrl('')).toBeFalsy()
  })

  it('rejects a relative path', () => {
    expect(isHttpsUrl('/verify/abc')).toBeFalsy()
  })

  it('rejects plain text', () => {
    expect(isHttpsUrl('not a url')).toBeFalsy()
  })
})
